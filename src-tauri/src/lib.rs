// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{AppHandle, WebviewWindow, Emitter};
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use serde_json::Value;
use std::io::Write;
use std::path::Path;
use zip::ZipArchive;
use std::io::Cursor;
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};

#[derive(Clone, Serialize)]
struct OAuthPayload {
    url: String,
}

// ============================================================================
// TERMINAL COMMANDS
// ============================================================================

#[tauri::command]
async fn execute_command(
    app: AppHandle,
    command: String,
    working_dir: Option<String>
) -> Result<Value, String> {
    use std::env;
    
    // Parse command into parts
    let parts: Vec<&str> = command.trim().split_whitespace().collect();
    if parts.is_empty() {
        return Err("Empty command".to_string());
    }
    
    let cmd = parts[0];
    let args = &parts[1..];
    
    // Set working directory
    let work_dir = working_dir.unwrap_or_else(|| {
        env::current_dir()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string()
    });
    
    println!("🔧 Executing: {} {:?} in {}", cmd, args, work_dir);
    
    // Start the process
    let mut child = Command::new(cmd)
        .args(args)
        .current_dir(&work_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to execute command: {}", e))?;
    
    // Capture stdout
    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;
    
    let stdout_reader = BufReader::new(stdout);
    let stderr_reader = BufReader::new(stderr);
    
    let mut output_lines = Vec::new();
    let mut error_lines = Vec::new();
    
    // Read stdout
    for line in stdout_reader.lines() {
        if let Ok(line) = line {
            println!("stdout: {}", line);
            output_lines.push(line.clone());
            
            // Emit line to frontend in real-time
            let _ = app.emit("terminal_output", serde_json::json!({
                "type": "stdout",
                "line": line
            }));
        }
    }
    
    // Read stderr
    for line in stderr_reader.lines() {
        if let Ok(line) = line {
            println!("stderr: {}", line);
            error_lines.push(line.clone());
            
            let _ = app.emit("terminal_output", serde_json::json!({
                "type": "stderr",
                "line": line
            }));
        }
    }
    
    // Wait for process to complete
    let status = child.wait().map_err(|e| format!("Failed to wait for command: {}", e))?;
    
    let result = serde_json::json!({
        "success": status.success(),
        "exit_code": status.code(),
        "stdout": output_lines.join("\n"),
        "stderr": error_lines.join("\n"),
        "command": command,
        "working_dir": work_dir
    });
    
    Ok(result)
}

#[tauri::command]
async fn get_current_dir() -> Result<String, String> {
    std::env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| format!("Failed to get current directory: {}", e))
}

#[tauri::command]
async fn change_directory(path: String) -> Result<String, String> {
    std::env::set_current_dir(&path)
        .map_err(|e| format!("Failed to change directory: {}", e))?;
    
    std::env::current_dir()
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| format!("Failed to get current directory: {}", e))
}

// ============================================================================
// FILE SYSTEM COMMANDS
// ============================================================================

#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
async fn write_file(path: String, contents: String) -> Result<(), String> {
    fs::write(&path, contents)
        .map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
async fn read_dir(path: String) -> Result<Vec<FileEntry>, String> {
    let entries = fs::read_dir(&path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    let mut files = Vec::new();

    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            let metadata = entry.metadata().ok();

            files.push(FileEntry {
                name: entry.file_name().to_string_lossy().to_string(),
                path: path.to_string_lossy().to_string(),
                is_dir: metadata.as_ref().map(|m| m.is_dir()).unwrap_or(false),
                size: metadata.as_ref().map(|m| m.len()).unwrap_or(0),
            });
        }
    }

    Ok(files)
}

#[tauri::command]
async fn create_dir(path: String) -> Result<(), String> {
    fs::create_dir_all(&path)
        .map_err(|e| format!("Failed to create directory: {}", e))
}

#[tauri::command]
async fn delete_file(path: String) -> Result<(), String> {
    fs::remove_file(&path)
        .map_err(|e| format!("Failed to delete file: {}", e))
}

#[tauri::command]
async fn delete_dir(path: String) -> Result<(), String> {
    fs::remove_dir_all(&path)
        .map_err(|e| format!("Failed to delete directory: {}", e))
}

#[tauri::command]
async fn file_exists(path: String) -> Result<bool, String> {
    Ok(PathBuf::from(path).exists())
}

#[derive(Clone, Serialize)]
struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    size: u64,
}

// ============================================================================
// OAUTH COMMANDS
// ============================================================================
#[tauri::command]
async fn open_oauth_window(app: AppHandle, url: String) -> Result<(), String> {
    let _window = WebviewWindow::builder(
        &app,
        "oauth",
        tauri::WebviewUrl::External(
            url.parse().map_err(|e| format!("Invalid URL: {}", e))?,
        ),
    )
    .title("GitHub OAuth - RepoSpace IDE")
    .inner_size(600.0, 700.0)
    .center()
    .resizable(false)
    .build()
    .map_err(|e| e.to_string())?;

    app.emit("oauth_window_opened", ())
        .map_err(|e| format!("Failed to emit event: {}", e))?;

    Ok(())
}

// ============================================================================
// GITHUB API COMMANDS (CORS-free)
// ============================================================================

#[tauri::command]
async fn github_device_code(client_id: String) -> Result<Value, String> {
    let client = reqwest::Client::new();
    
    let params = [
        ("client_id", client_id.as_str()),
        ("scope", "repo user read:org"),
    ];
    
    let response = client
        .post("https://github.com/login/device/code")
        .header("Accept", "application/json")
        .form(&params)  // Changed from .json() to .form()
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    
    let status = response.status();
    let body = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;
    
    if !status.is_success() {
        return Err(format!("GitHub API error: {} - {}", status, body));
    }
    
    serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse response: {} - Body: {}", e, body))
}

#[tauri::command]
async fn github_poll_token(client_id: String, device_code: String) -> Result<Value, String> {
    let client = reqwest::Client::new();
    
    let params = [
        ("client_id", client_id.as_str()),
        ("device_code", device_code.as_str()),
        ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
    ];
    
    let response = client
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .form(&params)  // Changed from .json() to .form()
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    
    let body = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;
    
    serde_json::from_str(&body)
        .map_err(|e| format!("Failed to parse response: {} - Body: {}", e, body))
}

#[tauri::command]
async fn github_get_user(access_token: String) -> Result<Value, String> {
    let client = reqwest::Client::new();
    
    let response = client
        .get("https://api.github.com/user")
        .header("Authorization", format!("Bearer {}", access_token))
        .header("Accept", "application/vnd.github.v3+json")
        .header("User-Agent", "RepoSpace-IDE")
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("GitHub API error: {}", response.status()));
    }
    
    let data = response
        .json::<Value>()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    Ok(data)
}

// ============================================================================
// GITHUB REPOSITORY DOWNLOAD COMMANDS
// ============================================================================

#[tauri::command]
async fn download_repo_zip(
    app: AppHandle,
    owner: String,
    repo: String,
    branch: String,
    save_path: String
) -> Result<String, String> {
    let client = reqwest::Client::new();
    
    let url = format!(
        "https://github.com/{}/{}/archive/refs/heads/{}.zip",
        owner, repo, branch
    );
    
    println!("📥 Downloading from: {}", url);
    
    // Emit progress: starting download
    let _ = app.emit("download_progress", serde_json::json!({
        "stage": "downloading",
        "progress": 10
    }));
    
    let response = client
        .get(&url)
        .header("User-Agent", "RepoSpace-IDE")
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("Download failed: HTTP {}", response.status()));
    }
    
    let _ = app.emit("download_progress", serde_json::json!({
        "stage": "downloading",
        "progress": 40
    }));
    
    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;
    
    let _ = app.emit("download_progress", serde_json::json!({
        "stage": "downloading",
        "progress": 70
    }));
    
    // Save ZIP file
    let zip_path = format!("{}/{}-{}.zip", save_path, repo, branch);
    let mut file = std::fs::File::create(&zip_path)
        .map_err(|e| format!("Failed to create file: {}", e))?;
    
    file.write_all(&bytes)
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
    let _ = app.emit("download_progress", serde_json::json!({
        "stage": "extracting",
        "progress": 80
    }));
    
    println!("✅ Downloaded to: {}", zip_path);
    
    Ok(zip_path)
}

#[tauri::command]
async fn extract_zip(app: AppHandle, zip_path: String, extract_to: String) -> Result<String, String> {
    let file = std::fs::File::open(&zip_path)
        .map_err(|e| format!("Failed to open ZIP: {}", e))?;
    
    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("Failed to read ZIP: {}", e))?;
    
    let _ = app.emit("download_progress", serde_json::json!({
        "stage": "extracting",
        "progress": 85
    }));
    
    // Create extraction directory
    std::fs::create_dir_all(&extract_to)
        .map_err(|e| format!("Failed to create directory: {}", e))?;
    
    let total_files = archive.len();
    
    // Extract all files
    for i in 0..total_files {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Failed to read file from ZIP: {}", e))?;
        
        let outpath = match file.enclosed_name() {
            Some(path) => Path::new(&extract_to).join(path),
            None => continue,
        };
        
        if file.name().ends_with('/') {
            std::fs::create_dir_all(&outpath)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    std::fs::create_dir_all(p)
                        .map_err(|e| format!("Failed to create parent directory: {}", e))?;
                }
            }
            
            let mut outfile = std::fs::File::create(&outpath)
                .map_err(|e| format!("Failed to create file: {}", e))?;
            
            std::io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("Failed to extract file: {}", e))?;
        }
        
        // Update progress periodically
        if i % 10 == 0 || i == total_files - 1 {
            let progress = 85 + ((i as f32 / total_files as f32) * 10.0) as i32;
            let _ = app.emit("download_progress", serde_json::json!({
                "stage": "extracting",
                "progress": progress
            }));
        }
    }
    
    let _ = app.emit("download_progress", serde_json::json!({
        "stage": "completing",
        "progress": 95
    }));
    
    println!("✅ Extracted to: {}", extract_to);
    
    Ok(extract_to)
}

#[tauri::command]
async fn get_repo_info(owner: String, repo: String, access_token: Option<String>) -> Result<Value, String> {
    let client = reqwest::Client::new();
    
    let url = format!("https://api.github.com/repos/{}/{}", owner, repo);
    
    let mut request = client
        .get(&url)
        .header("Accept", "application/vnd.github.v3+json")
        .header("User-Agent", "RepoSpace-IDE");
    
    if let Some(token) = access_token {
        request = request.header("Authorization", format!("Bearer {}", token));
    }
    
    let response = request
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("GitHub API error: {}", response.status()));
    }
    
    let data = response
        .json::<Value>()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    Ok(data)
}

#[tauri::command]
async fn get_repo_branches(owner: String, repo: String, access_token: Option<String>) -> Result<Value, String> {
    let client = reqwest::Client::new();
    
    let url = format!("https://api.github.com/repos/{}/{}/branches", owner, repo);
    
    let mut request = client
        .get(&url)
        .header("Accept", "application/vnd.github.v3+json")
        .header("User-Agent", "RepoSpace-IDE");
    
    if let Some(token) = access_token {
        request = request.header("Authorization", format!("Bearer {}", token));
    }
    
    let response = request
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("GitHub API error: {}", response.status()));
    }
    
    let data = response
        .json::<Value>()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    Ok(data)
}

// ============================================================================
// APP ENTRY POINT
// ============================================================================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            read_dir,
            create_dir,
            delete_file,
            delete_dir,
            file_exists,
            open_oauth_window,
            github_device_code,
            github_poll_token,
            github_get_user,
            download_repo_zip,
            extract_zip,
            get_repo_info,
            get_repo_branches,
            execute_command,
            get_current_dir,
            change_directory
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
