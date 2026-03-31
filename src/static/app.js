document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const loginModal = document.getElementById("login-modal");
  const profileModal = document.getElementById("profile-modal");
  const loginForm = document.getElementById("login-form");
  const userBtn = document.getElementById("user-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const profileInfo = document.getElementById("profile-info");
  const loginError = document.getElementById("login-error");
  const signupContainerSection = document.getElementById("signup-container-section");

  let currentUser = null;

  // Check authentication status on page load
  async function checkAuthStatus() {
    try {
      const response = await fetch("/auth/status");
      const data = await response.json();
      
      if (data.is_authenticated) {
        currentUser = data.user;
        updateUIForLoggedIn();
      } else {
        currentUser = null;
        updateUIForLoggedOut();
      }
    } catch (error) {
      console.error("Error checking auth status:", error);
      currentUser = null;
      updateUIForLoggedOut();
    }
  }

  // Update UI when user is logged in
  function updateUIForLoggedIn() {
    userBtn.textContent = `👤 ${currentUser.full_name}`;
    signupContainerSection.classList.remove("hidden");
  }

  // Update UI when user is logged out
  function updateUIForLoggedOut() {
    userBtn.textContent = "👤 Login";
    signupContainerSection.classList.add("hidden");
  }

  // Modal functions
  function showLoginModal() {
    loginModal.classList.remove("hidden");
    loginModal.style.display = "flex";
    loginError.classList.add("hidden");
    loginForm.reset();
  }

  function closeLoginModal() {
    loginModal.classList.add("hidden");
    loginModal.style.display = "none";
  }

  function showProfileModal() {
    if (currentUser) {
      profileInfo.innerHTML = `
        <p><strong>Name:</strong> ${currentUser.full_name}</p>
        <p><strong>Username:</strong> ${currentUser.username}</p>
        <p><strong>Role:</strong> ${currentUser.role}</p>
      `;
      profileModal.classList.remove("hidden");
      profileModal.style.display = "flex";
    }
  }

  function closeProfileModal() {
    profileModal.classList.add("hidden");
  }

  // Handle login
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      if (response.ok) {
        const data = await response.json();
        currentUser = data.user;
        closeLoginModal();
        updateUIForLoggedIn();
        fetchActivities();
        showMessage(`Welcome, ${currentUser.full_name}!`, "success");
      } else {
        const error = await response.json();
        loginError.textContent = error.detail || "Login failed";
        loginError.classList.remove("hidden");
      }
    } catch (error) {
      loginError.textContent = "Error logging in. Please try again.";
      loginError.classList.remove("hidden");
      console.error("Error logging in:", error);
    }
  });

  // Handle logout
  logoutBtn.addEventListener("click", async () => {
    try {
      const response = await fetch("/auth/logout", { method: "POST" });
      if (response.ok) {
        currentUser = null;
        closeProfileModal();
        updateUIForLoggedOut();
        fetchActivities();
        showMessage("Logged out successfully", "success");
      }
    } catch (error) {
      console.error("Error logging out:", error);
    }
  });

  // Close modals
  document.getElementById("close-login").addEventListener("click", closeLoginModal);
  document.getElementById("close-profile").addEventListener("click", closeProfileModal);

  // Close modal when clicking outside
  window.addEventListener("click", (event) => {
    if (event.target === loginModal) closeLoginModal();
    if (event.target === profileModal) closeProfileModal();
  });

  // Setup main button listeners
  userBtn.addEventListener("click", () => {
    if (currentUser) {
      showProfileModal();
    } else {
      showLoginModal();
    }
  });

  // Show message
  function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");
    setTimeout(() => messageDiv.classList.add("hidden"), 5000);
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons (only visible if logged in)
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        currentUser ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>` : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown (only if logged in)
        if (currentUser) {
          const option = document.createElement("option");
          option.value = name;
          option.textContent = name;
          activitySelect.appendChild(option);
        }
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        fetchActivities();
      } else {
        if (response.status === 401) {
          showMessage("You must be logged in to unregister students", "error");
        } else {
          showMessage(result.detail || "An error occurred", "error");
        }
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();
        fetchActivities();
      } else {
        if (response.status === 401) {
          showMessage("You must be logged in to sign up students", "error");
        } else {
          showMessage(result.detail || "An error occurred", "error");
        }
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  checkAuthStatus();
  fetchActivities();
});

