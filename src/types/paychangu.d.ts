/**
 * This declaration file tells TypeScript about the shape of the 'paychangu' module.
 * It provides type safety and autocompletion for the PaymentsService class.
 */
declare module 'paychangu' {
  /**
   * Configuration options for the PaymentsService constructor.
   */
  interface PayChanguConfig {
    apiKey: string;
    baseURL: string;
  }

  /**
   * The payload required to initiate a payment.
   */
  interface InitiatePaymentPayload {
    amount: number;
    currency: string;
    email: string;
    first_name: string;
    last_name: string;
    description: string;
    callbackUrl: string;
    returnUrl: string;
  }

  /**
   * The expected structure of the response from the initiatePayment method.
   */
  interface InitiatePaymentResponse {
    data?: {
      checkout_url?: string;
      // You can add other properties from the response here as you discover them
    };
    // Add other top-level response properties if they exist
  }

  /**
   * The main class for interacting with the PayChangu API.
   */
  class PaymentsService {
    constructor(config: PayChanguConfig);
    initiatePayment(payload: InitiatePaymentPayload): Promise<InitiatePaymentResponse>;
  }

  export default PaymentsService;
}
