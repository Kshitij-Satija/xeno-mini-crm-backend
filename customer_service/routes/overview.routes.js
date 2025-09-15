const express = require("express");
const {
  getDashboardStats
} = require("../controllers/overview.controller");

const router = express.Router();

router.get("/overview", getDashboardStats);

module.exports = router;
