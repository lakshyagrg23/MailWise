# MailWise: AI-Powered Email Management System

Managing an inbox can be overwhelming, with important emails often getting buried under less
relevant ones. MailWise helps users easily find critical emails by categorizing them intelligently.
Unlike basic spam filtering, it ensures that essential emails—whether urgent or potentially useful
later—are easy to locate. Additionally, users can personalize and specify categorization rules based
on what is important to them and the type of emails they receive, making the system highly
adaptable to individual needs.

<br>
<br>

MailWise is a complete email management platform designed to make accessing and organizing emails easier and more efficient. By using the **Gmail API**, MailWise securely fetches emails from the user's Gmail account after authentication via **Google OAuth**. It then categorizes these emails into major predefined categories such as Essential, Finance, and Updates, while also allowing users to create **personalized categories** for their specific needs, with **AI** handling segregation of received emails according to the personalization provided by the user.

In addition to organizing emails, MailWise enhances the **email composition** experience by providing **AI-assisted email writing**, making sending emails faster and more efficient. The system **optimizes** the **entire email workflow**, ensuring that users can easily manage and interact with their inbox.

<br>

![image](https://github.com/user-attachments/assets/be6b94dd-61ae-411b-9853-f92b30c2e99b)

<br>

## Features
📩 Email Viewing & Organization:

- AI-powered categorization using Google Gemini AI.
- User-defined categories – Users can create, modify, and delete categories based on their preferences.
- Email summaries on hover – Users can preview emails without opening them.

✍️ Email Composition & Sending:

- Email sending functionality – Users can compose and send emails directly from MailWise.
- AI-assisted email writing – Helps users draft better emails efficiently.
---

## Project Structure

```
├──client
├── build
├── node_modules
├── public
├── src
├── package-lock.json
├── package.json
└── README.md

server
├── attachments
├── controllers
│ ├── auth
│ ├── categories
│ ├── emails
│ └── fetch-emails
├── helpFunctions
├── node_modules
├── routes
├── .env
├── db.js
├── hj.js
├── server.js
├── package-lock.json
├── package.json
└── .gitignore
```

---

## 🛠️ Installation & Setup

### Prerequisites
Ensure you have the following installed:
- **Node.js** (v18+ recommended)
- **PostgreSQL**


### Backend Setup
```bash
cd server
npm install
```

Configure environment variables:
   Create a `.env` file in the root directory and add the following:
   ```sh
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   GOOGLE_REDIRECT_URI=

   DB_USER=
   DB_HOST=
   DB_NAME=
   DB_PASSWORD=
   DB_PORT=
   ```

Start the backend server:
```bash
node server.js
```

### Frontend Setup
```bash
cd client
npm install
npm start  
```

The application should now be running on **http://localhost:3000** (frontend) and **http://localhost:5000** (backend).

---

## Usage
1. **Login with Google** – Authenticate using your Gmail account.
2. **View categorized emails** – Emails are automatically sorted into predefined & custom categories.
3. **Create custom categories** – Add new categories based on preferences.
4. **Delete categories** – Remove unwanted categories.

---

## Technologies Used
- **Frontend**: ReactJS, Tailwind CSS
- **Backend**: NodeJS, ExpressJS
- **Database**: PostgreSQL
- **APIs Used**: Google OAuth, Gmail API, Gemini API 

---

## API Endpoints
### **Authentication**
- `GET /auth/google` – Initiates Google OAuth flow
- `GET /auth/google/callback` – Handles OAuth callback

### **Emails**
- `GET /emails/:userId` – Fetches categorized emails
- `POST /emails/:userId` – Stores email metadata

### **Categories**
- `GET /categories/:userId` – Fetches user-defined categories
- `POST /categories/:userId` – Creates a new category
- `DELETE /categories/:userId/:categoryName` – Deletes a category

---

##  Contribution
1. Fork the repository
2. Create a feature branch (`git checkout -b feature-branch`)
3. Commit your changes (`git commit -m 'Add new feature'`)
4. Push to the branch (`git push origin feature-branch`)
5. Open a pull request

---

## License
This project is licensed under the MIT License.

---
