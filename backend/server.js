require("dotenv").config(); // must be first
const path = require("path");

const express = require("express");
const passport = require("passport");
const connectDB = require("./config/db");
require("./passport/googleStrategy");
require("./jobs/reminderCron"); // Start Reminder Job

const app = express();

// Connect to DB
connectDB();

app.use(
  express.json({
    limit: "50mb",
  }),
);
app.use(
  express.urlencoded({
    limit: "50mb",
    extended: true,
  }),
);
app.use(passport.initialize());
app.use(require("cors")());

// Serve static frontend files
app.use(express.static(path.join(__dirname, "../frontend")));

// Routes
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/auth", require("./routes/googleAuth"));
app.use("/api/doctors", require("./routes/doctorRoutes"));
app.use("/api/appointments", require("./routes/appointmentRoutes"));
app.use("/api/medicines", require("./routes/medicineRoutes"));
app.use("/api/prescriptions", require("./routes/prescriptionRoutes"));
app.use("/api/dashboard", require("./routes/dashboardRoutes"));
app.use(
  "/api/doctor/appointments",
  require("./routes/doctorAppointmentRoutes"),
);
app.use("/api/ai", require("./routes/aiRoutes"));
app.use("/api/patient", require("./routes/patientProfileRoutes"));

// health route for quick checks
// health route for quick checks
app.get("/api/health", (req, res) =>
  res.json({
    status: "ok",
    env: process.env.NODE_ENV || "development",
  }),
);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Frontend accessible at http://localhost:${PORT}`);
});
