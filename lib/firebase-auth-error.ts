import { FirebaseError } from "firebase/app";

export function getFirebaseAuthErrorMessage(error: unknown): string {
  if (!(error instanceof FirebaseError)) {
    return error instanceof Error
      ? error.message
      : "Something went wrong. Please try again.";
  }

  switch (error.code) {
    case "auth/email-already-in-use":
      return "An account already exists for this email address.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/weak-password":
      return "Password must contain at least 8 characters.";
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "The email or password you entered is incorrect.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Unable to reach Firebase. Check your connection and try again.";
    case "storage/unauthorized":
      return "Your account cannot upload a profile photo with the current Storage rules.";
    case "storage/retry-limit-exceeded":
      return "The photo upload timed out. Please try again.";
    default:
      return "Authentication failed. Please try again.";
  }
}
