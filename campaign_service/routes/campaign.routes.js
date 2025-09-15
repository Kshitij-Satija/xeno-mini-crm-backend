const express = require("express");

const {previewAudience, createCampaign, deliveryReceipt, listCampaigns, getCampaign, getCampaignOverview} = require("../controllers/campaign.controller");

const router = express.Router();

router.get("/overview", getCampaignOverview);

router.post("/preview", previewAudience);
router.post("/", createCampaign);
router.post("/delivery-receipt", deliveryReceipt);
router.get("/", listCampaigns);
router.get("/:id", getCampaign);

module.exports = router;
