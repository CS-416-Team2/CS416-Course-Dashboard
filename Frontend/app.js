document.addEventListener("DOMContentLoaded", () => {
    
    // Handle Login Form Submission
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();
            // Basic transition logic: Redirect to the dashboard
            const btn = loginForm.querySelector('button[type="submit"]');
            btn.innerText = "Signing in...";
            btn.disabled = true;

            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 800);
        });
    }

    // Handle Logout
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            // Simple redirect back to login
            window.location.href = "index.html";
        });
    }

    // Modal Logic for Dashboard
    const addCourseBtn = document.getElementById("addCourseBtn");
    const addCourseModal = document.getElementById("addCourseModal");
    const closeModals = document.querySelectorAll(".close-modal");
    const addCourseForm = document.getElementById("addCourseForm");
    const courseGrid = document.getElementById("courseGrid");

    if (addCourseBtn && addCourseModal) {
        addCourseBtn.addEventListener("click", () => {
            addCourseModal.classList.remove("hidden");
        });

        closeModals.forEach(btn => {
            btn.addEventListener("click", () => {
                addCourseModal.classList.add("hidden");
            });
        });

        addCourseForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const courseName = document.getElementById("courseName").value;
            const courseCode = document.getElementById("courseCode").value;
            
            // Create a new card
            const newCard = document.createElement("div");
            newCard.className = "course-card glass-panel";
            newCard.onclick = () => window.location.href = `course.html?name=${encodeURIComponent(courseName)}`;
            newCard.innerHTML = `
                <div class="course-card-header">
                    <h4>${courseName}</h4>
                    <span class="badge">${courseCode}</span>
                </div>
                <p>0 Students</p>
                <div class="course-card-footer">
                    <span>0 Assignments</span>
                    <span class="status active">🟢 Active</span>
                </div>
            `;
            courseGrid.appendChild(newCard);

            addCourseModal.classList.add("hidden");
            addCourseForm.reset();
        });
    }
});
