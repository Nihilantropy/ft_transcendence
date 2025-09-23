export class CustomError extends Error {
	code: number;

	constructor(message: string, code: number = 500) {
		super(message);
		this.code = code;
		this.name = this.constructor.name;
	}
}