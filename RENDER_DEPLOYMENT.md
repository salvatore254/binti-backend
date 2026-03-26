# Render Deployment Guide

This document provides step-by-step instructions for deploying the Binti Events backend to Render.com.

## Prerequisites

- Render account (free tier is sufficient)
- GitHub repository connected to Render
- MongoDB Atlas database URL
- Pesapal Sandbox credentials
- M-Pesa Sandbox credentials
- Gmail SMTP credentials (or other email service)

## Deployment Steps

### 1. Connect GitHub Repository

1. Log in to [Render Dashboard](https://dashboard.render.com)
2. Click **New +** button
3. Select **Web Service**
4. Search for your GitHub repository (`binti-backend` or similar)
5. Select the repository and authorize Render to access it
6. Click **Connect**

### 2. Configure Service

#### Basic Settings
- **Name**: `binti-events-backend`
- **Environment**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Plan**: Free (or Starter if you need better performance)

#### Deploy Hook (Optional)
- You can enable auto-deployment on push to `main` branch
- Render automatically deploys when code is pushed to GitHub

### 3. Set Environment Variables

In the Render dashboard, navigate to **Environment** section and add all required variables:

```
NODE_ENV=production
PORT=5000
MONGODB_URI=<your-mongodb-atlas-url>
PESAPAL_CONSUMER_KEY=<your-pesapal-key>
PESAPAL_CONSUMER_SECRET=<your-pesapal-secret>
PESAPAL_API_URL=https://sandbox.pesapal.com
PESAPAL_CALLBACK_URL=https://<your-render-domain>/api/payments/pesapal/callback
USE_PESAPAL_MOCK=false
MPESA_CONSUMER_KEY=<your-mpesa-key>
MPESA_CONSUMER_SECRET=<your-mpesa-secret>
MPESA_CALLBACK_URL=https://<your-render-domain>/api/payments/mpesa/callback
MPESA_PASSKEY=<your-mpesa-passkey>
EMAIL_USER=<your-gmail-address>
EMAIL_PASSWORD=<your-gmail-app-password>
BACKEND_URL=https://<your-render-domain>
FRONTEND_URL=https://bintievents.vercel.app
```

**Important**: Replace `<your-render-domain>` with your actual Render domain (e.g., `binti-events-backend.onrender.com`)

### 4. Get Your Render Domain

After deployment:
1. Go to your service page on Render
2. Find the **URL** field at the top of the page
3. This is your backend domain (e.g., `https://binti-events-backend.onrender.com`)

### 5. Update External Services

#### Frontend (Vercel)
Update your frontend `.env.local` or configuration to use:
```
REACT_APP_API_URL=https://<your-render-domain>
```

#### Payment Callbacks
Make sure all callback URLs are updated in:
- **Pesapal Dashboard**: Update Webhook URL to `https://<your-render-domain>/api/payments/pesapal/callback`
- **M-Pesa Console**: Update CB URL to `https://<your-render-domain>/api/payments/mpesa/callback`

#### Email Notifications
Ensure Gmail account has "Less secure app access" enabled or use an App Password for SMTP.

## Monitoring

### Logs
View real-time logs:
1. Go to your service page on Render
2. Click on **Logs** tab
3. Monitor for errors or health checks

### Health Check
Test the health endpoint:
```bash
curl https://<your-render-domain>/api/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": 3600
}
```

## Troubleshooting

### Service Won't Start
- Check build logs for errors
- Verify all environment variables are set
- Check `package.json` and `server.js` are correct

### CORS Errors
- Verify frontend URL is correctly set in `FRONTEND_URL` env variable
- Ensure CORS middleware is properly configured in `server.js`

### Database Connection Failed
- Verify `MONGODB_URI` is correct
- Check MongoDB Atlas IP whitelist includes all IPs (0.0.0.0/0)
- Test connection locally first

### Payment Integration Issues
- Verify all API keys and secrets are correct
- Check callback URLs in dashboard configuration
- Review payment gateway logs for transaction details

## Free Tier Limitations

- Service spins down after 15 minutes of inactivity (cold starts)
- Limited to 750 hours/month
- Suitable for development and light production use

## Scaling to Paid Tier

When you need more performance:
1. Click **Settings** on your service
2. Select a **Paid Plan** (Starter or Standard)
3. Service will auto-upgrade with no downtime

## Deployment Status

- **Current Deployment**: [View on Render Dashboard](https://dashboard.render.com)
- **Repository**: https://github.com/salvatore254/binti-backend
- **Frontend**: https://bintievents.vercel.app
- **Database**: MongoDB Atlas

## Quick Reference

| Service | Status | URL |
|---------|--------|-----|
| Backend | Deployed | https://<your-render-domain> |
| Frontend | Deployed | https://bintievents.vercel.app |
| Database | MongoDB Atlas | - |
| Payment Gateway | Pesapal Sandbox | https://sandbox.pesapal.com |
| M-Pesa | Sandbox | - |

## Support

- [Render Documentation](https://render.com/docs)
- [Pesapal Sandbox Guide](https://developers.pesapal.com)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com)
