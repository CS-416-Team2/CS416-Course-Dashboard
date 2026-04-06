document.addEventListener("DOMContentLoaded", () => {
    // Populate Course Name from URL
    const urlParams = new URLSearchParams(window.location.search);
    const courseName = urlParams.get('name');
    if (courseName) {
        document.getElementById('courseTitle').innerText = courseName;
    }

    // Modal Logic
    const addAssignmentBtn = document.getElementById('addAssignmentBtn');
    const addAssignmentModal = document.getElementById('addAssignmentModal');
    const closeModals = document.querySelectorAll('.close-modal');
    const addAssignmentForm = document.getElementById('addAssignmentForm');
    const assignmentsList = document.getElementById('assignmentsList');

    if (addAssignmentBtn && addAssignmentModal) {
        addAssignmentBtn.addEventListener("click", () => {
            addAssignmentModal.classList.remove("hidden");
        });

        closeModals.forEach(btn => {
            btn.addEventListener("click", () => {
                addAssignmentModal.classList.add("hidden");
            });
        });
    }

    // File Upload Simulation
    const fileUploadZone = document.getElementById('fileUploadZone');
    const csvFileInput = document.getElementById('csvFileInput');
    const saveAssignmentBtn = document.getElementById('saveAssignmentBtn');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    let uploadedFileName = "";

    if (fileUploadZone && csvFileInput) {
        fileUploadZone.addEventListener("click", () => {
            csvFileInput.click();
        });

        fileUploadZone.addEventListener("dragover", (e) => {
            e.preventDefault();
            fileUploadZone.classList.add("dragover");
        });

        fileUploadZone.addEventListener("dragleave", () => {
            fileUploadZone.classList.remove("dragover");
        });

        fileUploadZone.addEventListener("drop", (e) => {
            e.preventDefault();
            fileUploadZone.classList.remove("dragover");
            
            if (e.dataTransfer.files.length > 0) {
                handleFileSelect(e.dataTransfer.files[0]);
            }
        });

        csvFileInput.addEventListener("change", (e) => {
            if (e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
            }
        });
    }

    function handleFileSelect(file) {
        if (file.name.endsWith(".csv")) {
            uploadedFileName = file.name;
            fileNameDisplay.innerText = `Selected File: ${file.name}`;
            saveAssignmentBtn.disabled = false;
        } else {
            alert("Please upload a valid CSV file.");
        }
    }

    // Handle Form Submission
    if (addAssignmentForm) {
        addAssignmentForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const assignmentName = document.getElementById('assignmentName').value;

            const newItem = document.createElement('div');
            newItem.className = 'assignment-item';
            newItem.innerHTML = `
                <div class="assignment-info">
                    <h4>${assignmentName}</h4>
                    <span class="assignment-meta">Added just now - Grades from ${uploadedFileName}</span>
                </div>
                <div class="assignment-grade">
                    <span class="badge">Uploaded</span>
                    <button class="btn btn-secondary">View Students</button>
                </div>
            `;
            assignmentsList.prepend(newItem);

            addAssignmentModal.classList.add("hidden");
            addAssignmentForm.reset();
            fileNameDisplay.innerText = "";
            saveAssignmentBtn.disabled = true;
            uploadedFileName = "";
        });
    }
});
