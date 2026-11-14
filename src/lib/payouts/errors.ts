/** Only deliberate, non-sensitive messages may cross the admin HTTP boundary. */
export class PayoutError extends Error {
  constructor(message:string) {super(message);this.name="PayoutError";}
}
