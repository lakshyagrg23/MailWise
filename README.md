# **MailWise - AI-Powered Email Segregation Platform**

![MailWise](https://your-image-link.com)

## 🚀 **Overview**
MailWise is an AI-powered email segregation platform that helps users automatically categorize their emails into predefined categories. Built with a **Gmail-like UI**, it enhances email organization, reduces clutter, and improves productivity.

### **Key Features**
✅ **Automatic Email Categorization** – Uses AI to classify emails into predefined labels such as **Essential, Social, Promotions, Updates, Finance, Subscriptions, and Miscellaneous**.  
✅ **Google OAuth Integration** – Secure login using **Google OAuth 2.0**.  
✅ **Gmail API Integration** – Fetches and processes emails directly from Gmail.  
✅ **AI-Powered Classification** – Utilizes **Google Gemini AI** for intelligent email sorting.  
✅ **Intuitive UI** – React-based, Gmail-like interface for a seamless user experience.  
✅ **Planned Feature:** **Custom Email Categories** – Users will be able to create personalized labels based on their preferences.  
✅ **Planned Enhancement:** **Hybrid AI Model** – Combining **Google Gemini AI** with a **fine-tuned BERT model** for faster, more efficient email classification.  

---

## 🛠 **Tech Stack**
**Frontend:** ReactJS, Tailwind CSS, Bootstrap  
**Backend:** Node.js, Express.js  
**APIs & Authentication:** Google OAuth 2.0, Gmail API, Google Gemini API  
**Future Model Enhancements:** NLP/BERT for optimized classification  

---

## 📌 **Installation & Setup**
### **Prerequisites**
Ensure you have the following installed:
- [Node.js](https://nodejs.org/)
- [npm](https://www.npmjs.com/)
- A **Google Cloud Project** with Gmail API & OAuth 2.0 enabled

### **1️⃣ Clone the Repository**
```bash
 git clone https://github.com/your-username/MailWise.git
 cd MailWise
```

### **2️⃣ Install Dependencies**
```bash
npm install
```

### **3️⃣ Set Up Environment Variables**
Create a `.env` file in the root directory and add your credentials:
```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=your-google-redirect-uri
SESSION_SECRET=your-secret-key
```

### **4️⃣ Run the Project**
```bash
npm start
```
The project will be accessible at: `http://localhost:3000`

---

## 🎯 **Project Structure**
```
📂 MailWise
 ├── 📂 client            # React Frontend
 ├── 📂 server            # Node.js Backend
 ├── 📂 public            # Static Files
 ├── 📂 src               # Frontend Components
 ├── 📜 package.json      # Dependencies & Scripts
 ├── 📜 .env              # Environment Variables
 ├── 📜 README.md         # Project Documentation
```

---

## 💡 **Future Roadmap**
- [ ] **Optimize API calls** to prevent unnecessary fetching.
- [ ] **Implement session persistence** to maintain user state.
- [ ] **Enable parallel AI classification** for multiple emails at once.
- [ ] **Introduce batch classification** to reduce processing time.
- [ ] **Implement lazy loading** for incremental email fetching.
- [ ] **Allow users to create custom categories** for personalized email organization.
- [ ] **Develop a hybrid AI model** integrating Google Gemini AI and NLP/BERT for enhanced classification.

---

## 🛠 **Contributing**
Contributions are welcome! Follow these steps to contribute:
1. Fork the repository.
2. Create a new branch (`git checkout -b feature-branch`).
3. Commit changes (`git commit -m 'Add new feature'`).
4. Push to the branch (`git push origin feature-branch`).
5. Open a **Pull Request**.

---

## 📄 **License**
This project is licensed under the **MIT License**.

---

## ✨ **Acknowledgments**
- **Google Cloud** – For providing OAuth and Gmail API services.
- **Google Gemini AI** – For AI-driven email classification.
- **React & Node.js Community** – For the amazing ecosystem!

---

## 📩 **Contact**
💻 **Developer:** Lakshya Garg  
📧 **Email:** l5grg23@gmail.com  
🔗 **LinkedIn:** [Your LinkedIn Profile](https://www.linkedin.com/in/lakshya-garg23/)  
🔗 **GitHub:** [Your GitHub Profile](https://github.com/lakshyagrg23)  

---

🚀 **MailWise – Organizing Your Inbox with AI!**
