/**
 * Luminous Chat — Attachment Manager
 * Extracted from script.js
 * Handles file selection, drag-and-drop, XHR uploading with progress, backend status polling, and preview UI.
 */

window.AttachmentManager = {
    // Internal State
    state: {
        uploadedFiles: [], // Array of { file_id, name, size, mime_type }
        sentLocalUrls: []
    },

    // Dependencies (Injected via init)
    deps: {
        getChatId: () => null,
        onUploadStateChange: () => {}
    },

    // DOM Elements
    elements: {
        attachBtn: null,
        fileInput: null,
        fileUploadZone: null,
        previewContainer: null
    },

    init: function(config) {
        this.deps = { ...this.deps, ...config };
        
        this.elements.attachBtn = document.getElementById("attach-btn");
        this.elements.fileInput = document.getElementById("file-input");
        this.elements.fileUploadZone = document.getElementById("file-upload-zone");
        this.elements.previewContainer = document.getElementById("file-preview-container");

        this.bindEvents();
    },

    getStagedFiles: function() {
        return [...this.state.uploadedFiles];
    },

    clearStagedFiles: function() {
        if (!this.state.sentLocalUrls) this.state.sentLocalUrls = [];
        this.state.uploadedFiles.forEach((f) => {
            if (f.localUrl) {
                this.state.sentLocalUrls.push(f.localUrl);
            }
        });
        this.state.uploadedFiles = [];
        if (this.elements.previewContainer) {
            this.elements.previewContainer.innerHTML = "";
            this.elements.previewContainer.classList.add("hidden");
        }
        if (this.elements.fileInput) {
            this.elements.fileInput.value = "";
        }
        this.deps.onUploadStateChange();
    },

    revokeSentUrls: function() {
        if (this.state.sentLocalUrls) {
            this.state.sentLocalUrls.forEach((url) => {
                if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
                    URL.revokeObjectURL(url);
                }
            });
            this.state.sentLocalUrls = [];
        }
    },

    bindEvents: function() {
        if (this.elements.attachBtn && this.elements.fileInput) {
            this.elements.attachBtn.addEventListener("click", () => {
                this.elements.fileInput.click();
            });
        }

        if (this.elements.fileInput) {
            this.elements.fileInput.addEventListener("change", async (e) => {
                const files = e.target.files;
                if (!files || files.length === 0) return;

                const uploadPromises = Array.from(files).map((file) => this.handleFileUpload(file));
                await Promise.all(uploadPromises);
                this.elements.fileInput.value = "";
            });
        }

        if (this.elements.fileUploadZone && this.elements.fileInput) {
            this.elements.fileUploadZone.addEventListener("click", () => {
                this.elements.fileInput.click();
            });

            this.elements.fileUploadZone.addEventListener("dragover", (e) => {
                e.preventDefault();
                this.elements.fileUploadZone.classList.add("dragover");
            });

            this.elements.fileUploadZone.addEventListener("dragleave", () => {
                this.elements.fileUploadZone.classList.remove("dragover");
            });

            this.elements.fileUploadZone.addEventListener("drop", async (e) => {
                e.preventDefault();
                this.elements.fileUploadZone.classList.remove("dragover");

                const files = e.dataTransfer.files;
                if (files && files.length > 0) {
                    const uploadPromises = Array.from(files).map((file) => this.handleFileUpload(file));
                    await Promise.all(uploadPromises);
                }
            });
        }
    },

    getFileType: function(file) {
        if (file.type) return file.type;
        const ext = file.name.split(".").pop().toLowerCase();
        const extToMime = {
            pdf: "application/pdf",
            docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            doc: "application/msword",
            txt: "text/plain",
            csv: "text/csv",
            md: "text/markdown",
            json: "application/json",
            js: "application/javascript",
            py: "text/x-python",
            html: "text/html",
            css: "text/css",
            png: "image/png",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            gif: "image/gif",
            webp: "image/webp",
            heic: "image/heic",
            mp4: "video/mp4",
            webm: "video/webm",
            mp3: "audio/mpeg",
            wav: "audio/wav",
        };
        return extToMime[ext] || "";
    },

    handleFileUpload: async function(file) {
        let currentFileId = null;
        const fileType = this.getFileType(file);
        const allowedTypes = [
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/plain",
            "text/csv",
            "text/markdown",
            "application/json",
            "application/javascript",
            "text/x-python",
            "text/html",
            "text/css",
            "image/png",
            "image/jpeg",
            "image/gif",
            "image/webp",
            "image/heic",
            "video/mp4",
            "video/webm",
            "audio/mpeg",
            "audio/wav",
        ];

        if (!allowedTypes.includes(fileType)) {
            const isReadable = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const arr = new Uint8Array(e.target.result);
                    for (let i = 0; i < arr.length; i++) {
                        if (arr[i] === 0) {
                            resolve(false);
                            return;
                        }
                    }
                    resolve(true);
                };
                reader.onerror = () => resolve(false);
                const slice = file.slice(0, Math.min(file.size, 1024));
                reader.readAsArrayBuffer(slice);
            });

            if (!isReadable) {
                if (window.showAlert) {
                    await window.showAlert(
                        "File Type Not Supported",
                        `${window.escapeHtml ? window.escapeHtml(file.name) : file.name} appears to be a binary file and is not supported. Only text, code, and media files are allowed.`
                    );
                }
                return;
            }
        }

        if (file.size > 100 * 1024 * 1024) {
            if (window.showAlert) {
                await window.showAlert(
                    "File Too Large",
                    `${window.escapeHtml ? window.escapeHtml(file.name) : file.name} exceeds the 100MB limit.`
                );
            }
            return;
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("chat_id", this.deps.getChatId());

        // Render Optimistic Upload Item
        const fileItem = document.createElement("div");
        fileItem.className = "file-item";
        fileItem.innerHTML = `
            <div class="file-icon">
                <div class="upload-spinner" style="width: 16px; height: 16px; border: 2px solid currentColor; border-top-color: transparent; animation: spin 1s linear infinite;"></div>
            </div>
            <div class="file-info">
                <div class="file-name">${window.escapeHtml ? window.escapeHtml(file.name) : file.name}</div>
                <div class="file-meta">
                    <span class="upload-status">Uploading...</span>
                    <span class="upload-size">${window.formatFileSize ? window.formatFileSize(0) : 0} / ${window.formatFileSize ? window.formatFileSize(file.size) : file.size}</span>
                </div>
            </div>
            <button class="remove-file-btn" title="Remove file"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
        `;

        const removeBtn = fileItem.querySelector(".remove-file-btn");
        removeBtn.addEventListener("click", () => {
            if (currentFileId) {
                const target = this.state.uploadedFiles.find((f) => f.file_id !== currentFileId);
                if (target && target.localUrl && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
                    URL.revokeObjectURL(target.localUrl);
                }
                this.state.uploadedFiles = this.state.uploadedFiles.filter((f) => f.file_id !== currentFileId);
            } else {
                this.state.uploadedFiles = this.state.uploadedFiles.filter((f) => !(f.name === file.name && !f.file_id));
            }
            if (fileItem.parentNode) fileItem.parentNode.removeChild(fileItem);
            if (this.state.uploadedFiles.length === 0 && this.elements.previewContainer) {
                this.elements.previewContainer.classList.add("hidden");
            }
            this.deps.onUploadStateChange();
        });

        if (this.elements.previewContainer) {
            this.elements.previewContainer.classList.remove("hidden");
            this.elements.previewContainer.appendChild(fileItem);
        }
        this.deps.onUploadStateChange();

        try {
            const uploadResult = await this.uploadFileWithProgress(
                file,
                formData,
                (loaded, total) => {
                    const percent = Math.round((loaded / total) * 100);
                    const statusEl = fileItem.querySelector(".upload-status");
                    const sizeEl = fileItem.querySelector(".upload-size");
                    if (statusEl) statusEl.textContent = `Uploading ${percent}%`;
                    if (sizeEl && window.formatFileSize)
                        sizeEl.textContent = `${window.formatFileSize(loaded)} / ${window.formatFileSize(file.size)}`;
                }
            );

            const statusEl = fileItem.querySelector(".upload-status");
            const sizeEl = fileItem.querySelector(".upload-size");
            if (statusEl) statusEl.textContent = "Processing...";
            if (sizeEl && window.formatFileSize) sizeEl.textContent = window.formatFileSize(file.size);

            currentFileId = uploadResult.file_id;
            const fileData = {
                file_id: uploadResult.file_id,
                name: uploadResult.original_filename,
                size: uploadResult.file_size,
                mime_type: uploadResult.mime_type,
                localUrl: (fileType.startsWith("image/") && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") 
                    ? URL.createObjectURL(file) 
                    : null
            };
            this.state.uploadedFiles.push(fileData);

            // Polling loop
            const pollProcessingStatus = async () => {
                try {
                    const response = await fetch(`${API_MODULES.FILES}/${fileData.file_id}/status`);
                    if (response.ok) {
                        const result = await response.json();
                        const status = result.processing_status;

                        if (!status) {
                            setTimeout(pollProcessingStatus, 1000);
                            return;
                        }

                        if (status === "completed") {
                            if (fileItem.parentNode) {
                                const iconClass = window.getIconClassForMime ? window.getIconClassForMime(fileData.mime_type) : "";
                                const iconHtml = window.getIconHtmlForMime ? window.getIconHtmlForMime(fileData.mime_type) : "📄";
                                
                                fileItem.innerHTML = `
                                    <div class="file-icon file-type-icon ${iconClass}">${iconHtml}</div>
                                    <div class="file-info">
                                        <div class="file-name">${window.escapeHtml ? window.escapeHtml(fileData.name) : fileData.name}</div>
                                        <div class="file-meta"><span class="file-status">Ready</span><span class="file-size">${window.formatFileSize ? window.formatFileSize(fileData.size) : fileData.size}</span></div>
                                    </div>
                                    <button class="remove-file-btn" title="Remove file"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
                                `;
                                const newRemoveBtn = fileItem.querySelector(".remove-file-btn");
                                newRemoveBtn.addEventListener("click", () => {
                                    const target = this.state.uploadedFiles.find((f) => f.file_id === fileData.file_id);
                                    if (target && target.localUrl && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
                                        URL.revokeObjectURL(target.localUrl);
                                    }
                                    this.state.uploadedFiles = this.state.uploadedFiles.filter((f) => f.file_id !== fileData.file_id);
                                    if (fileItem.parentNode) fileItem.parentNode.removeChild(fileItem);
                                    if (this.state.uploadedFiles.length === 0 && this.elements.previewContainer) {
                                        this.elements.previewContainer.classList.add("hidden");
                                    }
                                    this.deps.onUploadStateChange();
                                });
                            }
                            this.deps.onUploadStateChange();
                        } else if (status === "failed") {
                            if (fileItem.parentNode) {
                                const statusEl = fileItem.querySelector(".upload-status");
                                if (statusEl) statusEl.textContent = "Processing Failed";
                            }
                            this.deps.onUploadStateChange();
                        } else {
                            setTimeout(pollProcessingStatus, 1000);
                        }
                    } else {
                        setTimeout(pollProcessingStatus, 1000);
                    }
                } catch (error) {
                    setTimeout(pollProcessingStatus, 1000);
                }
            };
            pollProcessingStatus();
        } catch (error) {
            console.error("File upload error:", error);
            const statusEl = fileItem.querySelector(".upload-status");
            if (statusEl) statusEl.textContent = "Upload Failed";
            if (window.showAlert) {
                await window.showAlert("File Upload Failed", error.message || "An error occurred while uploading.");
            }
            if (currentFileId) {
                this.state.uploadedFiles = this.state.uploadedFiles.filter((f) => f.file_id !== currentFileId);
            } else {
                this.state.uploadedFiles = this.state.uploadedFiles.filter((f) => !(f.name === file.name && !f.file_id));
            }
            setTimeout(() => {
                if (fileItem.parentNode) fileItem.parentNode.removeChild(fileItem);
                if (this.state.uploadedFiles.length === 0 && this.elements.previewContainer) {
                    this.elements.previewContainer.classList.add("hidden");
                }
                this.deps.onUploadStateChange();
            }, 2000);
        }
    },

    uploadFileWithProgress: function(file, formData, onProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    onProgress(event.loaded, event.total);
                }
            };

            xhr.onload = () => {
                try {
                    const contentType = xhr.getResponseHeader("content-type");
                    let result;
                    if (contentType && contentType.includes("application/json")) {
                        result = JSON.parse(xhr.responseText);
                    } else {
                        result = { success: false, error: `Server returned ${xhr.status}` };
                    }

                    if (xhr.status === 200 && result.success) {
                        resolve(result);
                    } else {
                        let errorMsg = result.error || `Upload failed with status ${xhr.status}`;
                        if (xhr.status === 413) {
                            errorMsg = "File too large. Maximum size is 100MB.";
                        }
                        reject(new Error(errorMsg));
                    }
                } catch (e) {
                    reject(new Error("Failed to parse upload response"));
                }
            };

            xhr.onerror = () => {
                reject(new Error("Network error during upload"));
            };

            xhr.ontimeout = () => {
                reject(new Error("Upload timed out"));
            };

            xhr.open("POST", `${API_MODULES.FILES}/upload`, true);
            xhr.timeout = 3600000;
            xhr.setRequestHeader("Accept", "application/json");
            xhr.send(formData);
        });
    }
};
