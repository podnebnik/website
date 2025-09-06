import { AppError } from "../../types/common";

// 1. Error categorization patterns (simplified for example)
export function handleApiError(error: unknown): AppError {
  if (error instanceof Error) {
    if (error.message.includes("fetch") || error.message.includes("Network")) {
      return {
        category: "network",
        message: error.message,
        details: error.stack,
        timestamp: new Date()
      };
    }
    
    if (error.message.includes("validation") || error.message.includes("Invalid")) {
      return {
        category: "validation",
        message: error.message,
        details: error.stack,
        timestamp: new Date()
      };
    }
  }
  
  return {
    category: "unknown",
    message: typeof error === "string" ? error : "Unknown error occurred",
    timestamp: new Date()
  };
}

// 2. Error boundary helper for SolidJS
export function createErrorHandler(
  fallback: (error: AppError, reset: () => void) => any
) {
  return (error: Error, reset: () => void) => {
    const appError = handleApiError(error);
    return fallback(appError, reset);
  };
}

// 3. Async error handling wrapper
export async function safeAsync<T>(
  operation: () => Promise<T>,
  context = "operation"
): Promise<{ data?: T; error?: AppError }> {
  try {
    const data = await operation();
    return { data };
  } catch (error) {
    return { 
      error: {
        category: "unknown",
        message: `Failed to execute ${context}`,
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date()
      }
    };
  }
}

// 4. Form validation error handling
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export function validateWeatherForm(data: {
  stationId?: string;
  startDate?: string;
  endDate?: string;
}): ValidationResult {
  const errors: Record<string, string> = {};

  if (!data.stationId || data.stationId.trim() === "") {
    errors.stationId = "Postaja je obvezna";
  }

  if (!data.startDate) {
    errors.startDate = "Začetni datum je obvezen";
  }

  if (!data.endDate) {
    errors.endDate = "Končni datum je obvezen";
  }

  if (data.startDate && data.endDate) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    
    if (start > end) {
      errors.dateRange = "Začetni datum mora biti pred končnim";
    }

    if (end > new Date()) {
      errors.endDate = "Končni datum ne more biti v prihodnosti";
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

// 5. Network status handling
export function getNetworkStatusError(): AppError | null {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return {
      category: "network",
      message: "Ni povezave z internetom",
      details: "Preverite internetno povezavo in poskusite znova",
      timestamp: new Date()
    };
  }
  return null;
}

// 6. Retry mechanism with exponential backoff
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2
  }
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown error");

      if (attempt === config.maxAttempts) {
        break; // Don't delay on the last attempt
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        config.baseDelay * Math.pow(config.backoffFactor, attempt - 1),
        config.maxDelay
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error("All retry attempts failed");
}

// 7. User-friendly error messages (Slovenian)
export function getUserFriendlyMessage(error: AppError): string {
  switch (error.category) {
    case "network":
      if (error.message.includes("404")) {
        return "Podatki niso najdeni";
      }
      if (error.message.includes("500")) {
        return "Težava na strežniku. Poskusite kasneje.";
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return "Ni internetne povezave";
      }
      return "Težava s povezavo. Preverite internetno povezavo.";
      
    case "validation":
      return "Nepravilni podatki. Preverite vnos.";
      
    case "unknown":
    default:
      return "Prišlo je do nepričakovane napake. Poskusite znova.";
  }
}

// 8. Error logging utility
export class ErrorLogger {
  private static instance: ErrorLogger;
  private errors: AppError[] = [];

  static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  log(error: AppError, context?: string): void {
    const enrichedError: AppError = {
      ...error,
      details: context ? `${context}: ${error.details || ""}` : error.details,
      timestamp: new Date()
    };

    this.errors.push(enrichedError);
    
    // Keep only last 50 errors
    if (this.errors.length > 50) {
      this.errors = this.errors.slice(-50);
    }

    // Console logging for development
    if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
      console.error("[Error]", enrichedError);
    }
  }

  getRecentErrors(limit = 10): AppError[] {
    return this.errors.slice(-limit);
  }

  clearErrors(): void {
    this.errors = [];
  }
}

// 9. Usage examples
export const errorHandlerExamples = {
  // Component error boundary
  async handleComponentError(error: Error) {
    const appError = handleApiError(error);
    const logger = ErrorLogger.getInstance();
    logger.log(appError, "Component");
    return getUserFriendlyMessage(appError);
  },

  // API call with retry
  async fetchWithRetry<T>(url: string): Promise<T> {
    return retryWithBackoff(async () => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    });
  },

  // Form submission with validation
  async submitForm(formData: any) {
    const validation = validateWeatherForm(formData);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${Object.values(validation.errors).join(", ")}`);
    }
    
    const networkError = getNetworkStatusError();
    if (networkError) {
      throw new Error(networkError.message);
    }
    
    // Proceed with submission...
    return { success: true };
  }
};
