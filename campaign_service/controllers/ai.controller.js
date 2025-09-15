const { GoogleGenAI } = require("@google/genai");
const Campaign = require("../models/campaign.model"); 
const CommunicationLog = require("../models/communicationLog.model");
const mongoose = require("mongoose");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function parseSegmentRules(req, res) {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ message: "prompt is required" });
    }

    //console.log("Received prompt:", prompt);

    const systemPrompt = `
      Convert this natural language audience description into JSON rules.
      Allowed fields: lifetimeSpend, totalOrders, lastOrderDate, metadata.gender, metadata.location.
      Allowed operators: >, <, =, !=, >=, <=.
      Output must be valid JSON ONLY, no explanations. 
      Also the value returned needs to be only numerical and no strings such as days/ days ago etc.

      Format:
      {
        "logic": "AND" | "OR",
        "rules": [
          { "field": "fieldName", "operator": ">", "value": 1000 }
        ]
      }
    `;

    //console.log("Sending prompt to Gemini...");

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        { role: "user", text: `${systemPrompt}\n\nUser description: ${prompt}` },
      ],
    });

    //console.log("Gemini raw response:", JSON.stringify(response, null, 2));

    // 🔹 Correct extraction for v2.5 SDK
    let text = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    //console.log("Raw extracted text:", text);

    if (!text) {
      return res.status(500).json({ message: "No text returned from AI" });
    }

    // 🔹 Strip ```json or ``` wrapping
    text = text.replace(/```json|```/g, "").trim();
    //console.log("Cleaned text:", text);

    let rulesJson;
    try {
      rulesJson = JSON.parse(text);
      console.log("Parsed JSON rules:", rulesJson);
    } catch (err) {
      console.error("Failed to parse JSON:", text, err);
      return res.status(500).json({ message: "Failed to parse AI response" });
    }

    return res.json({ rules: rulesJson });
  } catch (err) {
    console.error("parseSegmentRules error:", err);
    return res.status(500).json({ message: "AI parsing failed" });
  }
}

async function generateMessageSuggestions(req, res) {
  try {
    const { objective } = req.body;
    if (!objective) return res.status(400).json({ message: "Campaign objective is required" });

    //console.log("Received campaign objective:", objective);

    const systemPrompt = `
      You are a marketing assistant. Given a campaign objective, generate 2–3 creative message variants.
      Each message should be short, engaging, and actionable. 
      Now, while making the messages, ensure they are unique and not repetitive. Also the message needs to be like "Hi [Customer Name], ...".
      Where Hi [Customer Name] is a placeholder for the actual customer name, which the code puts itself so you need to write a message for after that part.
      Return as a JSON array:
      [
        "Message variant 1",
        "Message variant 2",
        "Message variant 3"
      ]
      Only return valid JSON.
    `;

    //console.log("Sending prompt to Gemini...");

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", text: `${systemPrompt}\n\nCampaign objective: ${objective}` }],
    });

    //console.log("Gemini raw response:", JSON.stringify(response, null, 2));

    let text = response?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(500).json({ message: "No text returned from AI" });

    // Remove ```json and trim
    text = text.replace(/```json|```/g, "").trim();
    //console.log("Cleaned text:", text);

    let messages;
    try {
      messages = JSON.parse(text);
      if (!Array.isArray(messages)) messages = [String(messages)];
      //console.log("Parsed message suggestions:", messages);
    } catch (err) {
      console.error("Failed to parse JSON:", text, err);
      return res.status(500).json({ message: "Failed to parse AI response" });
    }

    // Always send as an array of messages
    return res.json({ messages });
  } catch (err) {
    console.error("generateMessageSuggestions error:", err);
    return res.status(500).json({ message: "AI message generation failed" });
  }
}

async function generateCampaignInsight(req, res) {
  try {
    const { campaignId } = req.body;
    if (!campaignId || !mongoose.Types.ObjectId.isValid(campaignId)) {
      return res.status(400).json({ message: "Invalid campaignId" });
    }

    // Fetch campaign and message stats
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });

    const logs = await CommunicationLog.find({ campaignId });
    const totalAudience = logs.length;
    const sent = logs.filter((l) => l.status === "SENT").length;
    const failed = logs.filter((l) => l.status === "FAILED").length;

    // Add status + deliveryMode + scheduledAt for better context
    const payloadForAI = {
      campaignName: campaign.campaignName,
      status: campaign.status, // e.g. PENDING, PROCESSING, COMPLETED
      deliveryMode: campaign.deliveryMode, // IMMEDIATE or SCHEDULED
      scheduledAt: campaign.scheduledAt,   // include datetime if scheduled
      totalAudience,
      sent,
      failed,
      rules: campaign.rules || [],
    };

    const systemPrompt = `
      You are a marketing insights assistant. Given a campaign's message stats, targeting rules, and scheduling info, generate a concise, human-readable summary. 
      Always include:
      - Audience reached
      - Messages delivered
      - Failed deliveries
      - Campaign schedule status (if the campaign is scheduled, clearly mention it)
      - Interesting highlights based on rules
      
      Example output:
      "Your campaign reached 1,284 users. 1,140 messages were delivered. Customers with > ₹10K spend had a 95% delivery rate. 
      This campaign is scheduled to run on Sep 20, 2025."
      Also, if the campaign has not been sent yet, do not mention how many customers it has reached and no info about the messages. Do mention rest as in example.
      Respond in plain English. No JSON.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        { role: "user", text: `${systemPrompt}\n\nCampaign stats:\n${JSON.stringify(payloadForAI, null, 2)}` },
      ],
    });

    let insight = response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    insight = insight.trim();

    return res.json({ insight });
  } catch (err) {
    console.error("generateCampaignInsight error:", err);
    return res.status(500).json({ message: "Failed to generate insight" });
  }
}



module.exports = { parseSegmentRules, generateMessageSuggestions, generateCampaignInsight };
