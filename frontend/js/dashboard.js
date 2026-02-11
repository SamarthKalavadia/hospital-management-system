const userId = localStorage.getItem("userId");
const role = localStorage.getItem("role");

if (!userId || !role) {
  location.href = "login.html";
}

const url =
  role === "doctor"
    ? `https://hospital-management-system-production-06ba.up.railway.app/api/dashboard/doctor/${userId}`
    : `https://hospital-management-system-production-06ba.up.railway.app/api/dashboard/patient/${userId}`;

fetch(url)
  .then(res => res.json())
  .then(data => {
    document.getElementById("title").innerText =
      role === "doctor" ? "Doctor Dashboard" : "Patient Dashboard";

    document.getElementById("total").innerText =
      data.totalPatients || data.totalAppointments;

    document.getElementById("today").innerText =
      data.appointmentsToday || "-";

    document.getElementById("upcoming").innerText = data.upcoming;
  });

function logout() {
  localStorage.clear();
  location.href = "login.html";
}
