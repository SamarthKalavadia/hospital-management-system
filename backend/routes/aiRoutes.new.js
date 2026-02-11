router.post('/medicine-demand', auth, async (req, res) => {
  try {
    // 1. Validate permissions
    if (!req.user || req.user.role !== 'doctor') {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    // 2. Extract Input
    const { medicineName, currentStock, dailyAverageUsage, prescriptionsLast30Days } = req.body;

    // 3. Strict Validation
    if (!medicineName || typeof currentStock !== 'number' || typeof dailyAverageUsage !== 'number') {
        // Validation Failed -> Return Normal Safe State
        return res.json({
            status: "Normal",
            estimatedDays: "Insufficient data",
            suggestion: "Monitor usage periodically"
        });
    }

    // 4. Deterministic Logic
    // If usage is 0, we can't estimate days, but stock is safe (not draining)
    if (dailyAverageUsage <= 0) {
        return res.json({
            status: "Normal",
            estimatedDays: "Usage too low to estimate",
            suggestion: "Stock levels appear stable"
        });
    }

    const estimatedDays = Math.floor(currentStock / dailyAverageUsage);

    // 5. Classification
    let status = "Normal";
    let suggestion = "Stock levels are healthy.";

    if (estimatedDays < 7) {
        status = "Critical";
        suggestion = "Restock immediately to avoid shortage.";
    } else if (estimatedDays >= 7 && estimatedDays <= 15) {
        status = "Low";
        suggestion = "Plan procurement soon.";
    }

    // 6. Return Strict Response
    return res.json({
        status: status,
        estimatedDays: estimatedDays,
        suggestion: suggestion
    });

  } catch (err) {
    console.error("AI Demand Prediction Error:", err);
    // Silent Fallback
    return res.json({
        status: "Normal",
        estimatedDays: "N/A",
        suggestion: "Monitor usage manually"
    });
  }
});
