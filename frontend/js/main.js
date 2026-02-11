function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const role = new URLSearchParams(window.location.search).get("role");

  const url =
    role === "doctor"
      ? "https://hospital-management-system-production-06ba.up.railway.app/api/doctors/login"
      : "https://hospital-management-system-production-06ba.up.railway.app/api/users/login";

  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      role,
    }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data && data.success) {
        // save token and user info
        if (data.token) localStorage.setItem("token", data.token);
        if (data.user) {
          const user = Object.assign({}, data.user, {
            name:
              (data.user.firstName || "") +
              (data.user.lastName ? " " + data.user.lastName : ""),
          });
          localStorage.setItem("user", JSON.stringify(user));
          localStorage.setItem("userId", data.user._id);
          localStorage.setItem("role", data.user.role || role);
        }

        if ((data.user && data.user.role) === "doctor" || role === "doctor") {
          location.href = "doctor-dashboard.html";
        } else {
          location.href = "patient-dashboard.html";
        }
      } else {
        window.showToast("error", data.message || "Invalid login");
      }
    });
}

function registerUser() {
  const name = document.getElementById("name").value;
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const age = document.getElementById("age").value;
  const contact = document.getElementById("contact").value;

  if (!name || !email || !password || !age || !contact) {
    window.showToast("error", "All fields are required");
    return;
  }

  fetch(
    "https://hospital-management-system-production-06ba.up.railway.app/api/users/register",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        password,
        age,
        contact,
      }),
    },
  )
    .then((res) => res.json())
    .then((data) => {
      if (data.message === "User registered") {
        window.showToast("success", "Registration successful");
        location.href = "login.html?role=patient";
      } else {
        window.showToast("error", data.message || "Registration failed");
      }
    })
    .catch((err) => window.handleError(err, "Registration"));
}
