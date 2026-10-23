const apiRequest = async (path, body) => {
  const response = await fetch(`/api/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
};

const currentPath = location.pathname.replace(/\/$/, "") || "/";
const form = document.querySelector("form");

if (form && ["/login", "/register", "/forgot-password", "/verify-otp", "/reset-password"].includes(currentPath)) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      if (currentPath === "/register") {
        await apiRequest("register", values);
        alert("Account created. Please sign in.");
        location.assign("/login");
      } else if (currentPath === "/login") {
        await apiRequest("login", values);
        location.assign("/dashboard");
      } else if (currentPath === "/forgot-password") {
        sessionStorage.setItem("agronex_reset_email", values.email);
        const result = await apiRequest("forgot-password", values);
        alert(result.message || "Check your email for the reset code.");
        location.assign("/verify-otp");
      } else if (currentPath === "/verify-otp") {
        await apiRequest("verify-otp", { email: sessionStorage.getItem("agronex_reset_email"), otp: values.otp });
        location.assign("/reset-password");
      } else if (currentPath === "/reset-password") {
        if (values.password !== values.confirm_password) throw new Error("Passwords do not match.");
        await apiRequest("reset-password", values);
        sessionStorage.removeItem("agronex_reset_email");
        alert("Password updated. Please sign in.");
        location.assign("/login");
      }
    } catch (error) {
      alert(error.message);
    }
  });
}

if (currentPath === "/dashboard") {
  fetch("/api/me", { credentials: "same-origin" }).then((response) => {
    if (!response.ok) location.replace("/login");
  }).catch(() => location.replace("/login"));
}

document.querySelectorAll('a[href="/logout"]').forEach((link) => {
  link.addEventListener("click", async (event) => {
    event.preventDefault();
    await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
    location.assign("/");
  });
});
