# Mini CRM Platform

A lightweight CRM platform with customer segmentation, personalized campaign delivery, and AI-powered insights.
This project is built as part of the Xeno SDE Internship Assignment – 2025.

## Features

- **Authentication**: Google OAuth 2.0 for secure login.

- **Customer & Orders Management:**
  - Ingestion via REST APIs.
  - Asynchronous persistence using RabbitMQ + Consumers.

- **Campaign Management:**
  - Create campaigns with dynamic rules.
  - Track campaign history & delivery stats.

- **Asynchronous Processing:**
  - Pub/Sub architecture with RabbitMQ.
  - Separate consumers for Customers, Orders, and Campaigns.

- **Vendor API Simulation:**
  - ~90% success, ~10% failure delivery rates.
  - Delivery Receipts pushed back to update communication logs.

- **AI Integration**: I have added 4 AI features:
  - Natural Language to Segment Rules: Allow users to write prompts like "People who haven’t shopped in 6 months and spent over ₹5K" and convert them into logical rules.
  - AI-Driven Message Suggestions: Given a campaign objective (e.g., "bring back inactive users"), generate 3 message variants to choose from. 
  - Campaign Performance Summarization: Instead of just showing sent/failed stats, generate a human-readable insight summary: "Your campaign reached 1,284 users. 1,140 messages were delivered. Customers with > ₹10K spend had a 95% delivery rate."
  - Smart Scheduling Suggestions: Recommend the best time/day to send a campaign based on customer activity patterns (you can mock or simulate this logic).

## 🏗️ Architecture

The system follows a microservices + event-driven architecture.



### Key Components

- **Frontend**: React + Vite (talks only to API Gateway).

- **API Gateway**:
  - Handles Google OAuth login.
  - Routes requests to microservices.
  - Auth validation for all protected endpoints.

- **Microservices**:
  - Customer/Order Service → CRUD APIs, publishes events to RabbitMQ.
  - Campaign Service → Campaign creation, processing, and delivery APIs.

- **Message Broker (RabbitMQ)**:
  - Customer Queues: create, update, delete.
  - Order Queues: create, update, delete.
  - Campaign Queues: create, process, delivery, delivery receipts.

- **Consumers**:
  - Customer Consumer → updates Customer DB.
  - Order Consumer → updates Order DB.
  - Campaign Consumer → processes campaigns, sends via Vendor API, handles delivery receipts.

- **Databases (MongoDB)**:
  - Customer DB, Order DB, Campaign DB.

- **External Services**:
  - Google OAuth 2.0.
  - Vendor API (simulated message delivery + receipts).

## 🖼️ Architecture Diagram

(docs/Xeno_Architecture.png)

## ⚙️ Tech Stack

- **Frontend**: React + Vite
- **Backend**: Node.js (API Gateway + Microservices)
- **Database**: MongoDB
- **Message Broker**: RabbitMQ
- **Auth**: Google OAuth 2.0
- **Deployment**: Render(Backend) / Vercel (Frontend)
- **AI APIs**: Gemini API (Used Gemini 2.0 Flash)

## 🚀 Setup

### Prerequisites

- Node.js
- MongoDB
- RabbitMQ (I have used a cloud based rabbitmq instance using )

### Steps

1. Clone the repository:
   ```
   git clone https://github.com/<your-username>/mini-crm.git
   cd xeno-mini-crm-backend
   ```

2. As there are 6 services that you need to run, I would recommend you do this in 6 separate terminals:
   ```
   cd api_gateway/server
   cd customer_service
   cd customer_consumer
   cd campaign_service
   cd campaign_consumer
   cd vendor_api

3. Install dependencies for all backend services.
   ```
   npm install
   ```

4. Start RabbitMQ and MongoDB locally. Run command for official RabbitMQ image on docker:
   ```
   docker run -d --hostname rabbitmq-host \
  --name rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  rabbitmq:3-management
   ```

5. Configure environment variables:
   * Each service has a separate set of environment variables.
   * API Gateway
   ```PORT=5000
   CRM_MONGO_URI=your_mongodb_uri
   FRONTEND_URI=http://localhost:5173
   GOOGLE_CLIENT_ID=your_own_client_id
   GOOGLE_CLIENT_SECRET=your_own_client_secret
   GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
   SESSION_SECRET=supersecret
   CUSTOMER_SERVICE_URI=http://localhost:6000
   CAMPAIGN_SERVICE_URI=http://localhost:7000
   ```
   * Customer Service 
   ```
   PORT=6000
   CUSTOMER_DB_URI=your_mongodb_uri
   RABBITMQ_URI=amqp://guest:guest@localhost:5672 #run in a docker container
   AUTH_GATEWAY_URL=http://localhost:5000
   CAMPAIGN_SERVICE_URI=http://localhost:7000
   
   ```
   * Customer Consumer
   ```
   CUSTOMER_DB_URI=your_mongodb_uri
   RABBITMQ_URI=amqp://guest:guest@localhost:5672 #run in a docker container
   PORT=6001
   ```
   * Campaign Service
   ```
   
   CAMPAIGN_DB_URI=your_mongodb_uri
   CUSTOMER_DB_URI=your_mongodb_uri
   SERVICE_SECRET=supersecret
   CUSTOMER_SERVICE_URI=http://localhost:6000
   NODE_ENV=development
   PORT=7000
   API_GATEWAY_URI=http://localhost:5000
   GEMINI_API_KEY=your_api_key_from_aistudio
   DUMMY_VENDOR_URI=http://localhost:9000
   RABBITMQ_URI=amqp://guest:guest@localhost:5672
   ```
   * Campaign Consumer
   ```
   CAMPAIGN_DB_URI=your_mongodb_uri
   CUSTOMER_DB_URI=your_mongodb_uri
   SERVICE_SECRET=supersecret
   GEMINI_API_KEY=your_api_key_from_aistudio
   NODE_ENV=development
   PORT=7001
   VENDOR_API_URI=http://localhost:9000
   RABBITMQ_URI=amqp://guest:guest@localhost:5672
   ```
6. Run backend:
   ```
   #In all backend services
   npm run dev #for dev mode, nodemon is installed
   node server.js #for production
   ```

## 📊 Known Limitations

- Vendor API is mocked (not real).
- Campaign performance insights are basic; AI-powered summarization can be expanded.
- Free hosting (Render) requires consumers to run as separate servers instead of lightweight workers.

## 🎥 Demo

- **Deployed Project**: https://xeno-minicrm.vercel.app/
- **Demo Video**: https://www.youtube.com/watch?v=q8ut8Zgsujg