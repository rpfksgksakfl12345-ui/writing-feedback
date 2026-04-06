CREATE TYPE "InputType" AS ENUM ('TYPED', 'PHOTO');

CREATE TYPE "OcrStatus" AS ENUM ('NONE', 'PROCESSING', 'DONE', 'FAILED');

ALTER TABLE "Submission"
ADD COLUMN     "inputType" "InputType" NOT NULL DEFAULT 'PHOTO',
ADD COLUMN     "content" TEXT,
ADD COLUMN     "ocrStatus" "OcrStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "ocrError" TEXT;

ALTER TABLE "Submission"
ALTER COLUMN "imageUrl" DROP NOT NULL;
