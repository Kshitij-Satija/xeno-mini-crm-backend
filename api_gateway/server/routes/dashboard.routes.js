const express = require("express");
const router = express.Router();
const { getOverviewStats } = require("../controllers/dashboard.controller");

router.get("/overview", getOverviewStats);

module.exports = router;
