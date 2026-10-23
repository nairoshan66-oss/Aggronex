// ================================
// AgroNex Login Script
// ================================

// Form Elements
const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const emailGroup = document.getElementById("emailGroup");
const passwordGroup = document.getElementById("passwordGroup");

const submitBtn = document.getElementById("submitBtn");

// Password Toggle
const togglePassword = document.getElementById("togglePassword");
const eyeOpen = document.querySelector(".eye-open");
const eyeClosed = document.querySelector(".eye-closed");


// ================================
// Toggle Password Visibility
// ================================
if (togglePassword) {
  togglePassword.addEventListener("click", () => {

    if (passwordInput.type === "password") {
      passwordInput.type = "text";
      if (eyeOpen) eyeOpen.style.display = "none";
      if (eyeClosed) eyeClosed.style.display = "block";
    } else {
      passwordInput.type = "password";
      if (eyeOpen) eyeOpen.style.display = "block";
      if (eyeClosed) eyeClosed.style.display = "none";
    }

  });
}


// ================================
// Show Error Function
// ================================
function showError(group, message) {
  const errorSpan = group.querySelector(".error-message");
  errorSpan.textContent = message;
  group.classList.add("error");
}


// ================================
// Clear Error Function
// ================================
function clearError(group) {
  const errorSpan = group.querySelector(".error-message");
  errorSpan.textContent = "";
  group.classList.remove("error");
}


// ================================
// Form Submit Validation
// ================================
loginForm.addEventListener("submit", function (e) {

  clearError(emailGroup);
  clearError(passwordGroup);

  let valid = true;

  const emailValue = emailInput.value.trim();
  const passwordValue = passwordInput.value.trim();

  if (emailValue === "") {
    showError(emailGroup, "Email is required.");
    valid = false;
  }

  if (passwordValue === "") {
    showError(passwordGroup, "Password is required.");
    valid = false;
  }

  if (!valid) {
    e.preventDefault();
  }

});