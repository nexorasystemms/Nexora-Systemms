# Gmail SMTP Setup Guide

## Step 1: Enable 2-Step Verification
1. Go to [Google Account Settings](https://myaccount.google.com/)
2. Click **Security** in the left sidebar
3. Under "Signing in to Google", click **2-Step Verification**
4. Follow the setup process if not already enabled

## Step 2: Generate App Password
1. In Google Account Settings → Security
2. Under "Signing in to Google", click **App passwords**
3. Select **Mail** from the dropdown
4. Click **Generate**
5. **Copy the 16-character password** (format: xxxx xxxx xxxx xxxx)

## Step 3: Update .env.local
Add these lines to your .env.local file:

```env
GMAIL_USER=mubianasaya@gmail.com
GMAIL_APP_PASSWORD=your_16_character_password_here
```

## Step 4: Test Gmail SMTP
Run: `node test-gmail.js`

The system will automatically use Gmail if both variables are set, falling back to Zoho if Gmail fails.