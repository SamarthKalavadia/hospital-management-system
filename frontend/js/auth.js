// Simple registration handler (used by register.html when present)
document.getElementById("registerForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const firstName = document.getElementById("firstName").value;
  const lastName = document.getElementById("lastName").value;
  const email = document.getElementById("email").value;
  const phone = document.getElementById("phone").value;
  const password = document.getElementById("password")?.value || null;

  const res = await fetch("https://hospital-management-system-production-06ba.up.railway.app/api/users/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ firstName, lastName, email, phone, password })
  });

  const data = await res.json();
  alert(data.message || (data.success ? "Registered" : "Failed"));
  if (data.success) window.location.href = "login.html";
});
