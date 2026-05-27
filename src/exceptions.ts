export class CognitorError extends Error {
    public readonly statusCode?: number;

    constructor(message: string, statusCode?: number) {
        super(message);
        this.name = "CognitorError";
        this.statusCode = statusCode;
    }
}

export class AuthenticationError extends CognitorError {
    constructor(message: string, statusCode?: number) {
        super(message, statusCode);
        this.name = "AuthenticationError";
    }
}

export class NotFoundError extends CognitorError {
    constructor(message: string, statusCode?: number) {
        super(message, statusCode);
        this.name = "NotFoundError";
    }
}

export class ConflictError extends CognitorError {
    constructor(message: string, statusCode?: number) {
        super(message, statusCode);
        this.name = "ConflictError";
    }
}

export class ValidationError extends CognitorError {
    constructor(message: string, statusCode?: number) {
        super(message, statusCode);
        this.name = "ValidationError";
    }
}

export class ServerError extends CognitorError {
    constructor(message: string, statusCode?: number) {
        super(message, statusCode);
        this.name = "ServerError";
    }
}
