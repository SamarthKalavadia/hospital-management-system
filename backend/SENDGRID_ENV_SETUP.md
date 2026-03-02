# SendGrid Environment Variables

## Required for Production (Railway)

```env
# SendGrid API Configuration
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_FROM_EMAIL=noreply@samyakhospital.com

# Frontend URL (already configured)
FRONTEND_URL=https://your-production-frontend.com
```

## How to Get These Values

### SENDGRID_API_KEY

1. Go to https://app.sendgrid.com/
2. Navigate to: Settings → API Keys
3. Click "Create API Key"
4. Name it (e.g., "Hospital Management System")
5. Select "Full Access" or "Restricted Access" with "Mail Send" permission
6. Copy the key (it's shown only once!)

### SENDGRID_FROM_EMAIL

- Must be a verified sender email in SendGrid
- Go to: Settings → Sender Authentication
- Either verify a single email or verify your entire domain
- Use the verified email address here

## Old Variables (No Longer Needed)

These can be removed from Railway:

```env
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-app-password
```

## Testing Locally

Create a `.env` file in the `backend` directory:

```env
SENDGRID_API_KEY=SG.your_test_api_key_here
SENDGRID_FROM_EMAIL=your-verified-email@domain.com
FRONTEND_URL=http://localhost:3000
```

**Important:** Never commit `.env` files to Git!
