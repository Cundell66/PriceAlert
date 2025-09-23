# **App Name**: CruiseCatcher

## Core Features:

- API Monitoring: Monitor the MSC cruise price API every fifteen minutes, using the provided endpoint URL and authentication headers.
- Price Drop Detection: Detect price reductions for any cruise room based on changes in the API's JSON response.
- Alert Triggering: Trigger an alert (email) when a price drop is detected, gathering necessary details to email.
- Email Notification: Send an email notification containing the ship name, cruise date, vendor ID, previous price ('from'), and new price ('to') whenever a price drop occurs. Uses tool to decide when and how to best communicate prices
- Configuration: Allow configuration of the app, accepting the api endpoint url, authentication headers for API access, and destination email for notification.
- Status Display: Displays status of monitoring, with success/failure alerts.

## Style Guidelines:

- Primary color: Deep blue (#1E3A8A) to evoke a sense of trust and the sea.
- Background color: Light gray (#F5F5F5) for a clean and professional feel.
- Accent color: Teal (#26A69A) for interactive elements and highlights.
- Font pairing: 'Belleza' (sans-serif) for headlines, 'Alegreya' (serif) for body text, evoking personality while maintaing excellent readability.
- Use simple, modern icons related to travel, cruises, and alerts.
- Clean, card-based layout for displaying status and configuration options.
- Subtle animations for loading states and alert notifications.