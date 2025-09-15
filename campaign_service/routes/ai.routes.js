const express = require("express");
const { parseSegmentRules, generateMessageSuggestions, generateCampaignInsight } = require("../controllers/ai.controller");

const router = express.Router();

router.post("/parse-segment", parseSegmentRules);
router.post("/message-suggestions", generateMessageSuggestions);
router.post("/insight", generateCampaignInsight);


module.exports = router;
