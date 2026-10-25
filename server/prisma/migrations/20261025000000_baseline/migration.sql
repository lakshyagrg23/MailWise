-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "google_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "profile_pic_url" TEXT,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "token_expiry" TIMESTAMP(3),
    "update" BIGINT DEFAULT 1,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_metadata" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "email_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "attachname" TEXT,
    "emailsummary" TEXT,
    "received_date" TIMESTAMP(3),
    "update" BIGINT DEFAULT 1,

    CONSTRAINT "email_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_preferences" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "category_name" TEXT NOT NULL,
    "category_description" TEXT NOT NULL,

    CONSTRAINT "category_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "email_metadata_user_id_email_id_key" ON "email_metadata"("user_id", "email_id");

-- CreateIndex
CREATE UNIQUE INDEX "category_preferences_user_id_category_name_key" ON "category_preferences"("user_id", "category_name");

-- AddForeignKey
ALTER TABLE "email_metadata" ADD CONSTRAINT "email_metadata_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_preferences" ADD CONSTRAINT "category_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

