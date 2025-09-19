export class BaseError extends Error {
  constructor(props) {
    const { error, message, code, stack } = props;
    super(message || error?.message || 'An error has occurred');
    this.name = 'Error';
    this.code = code || error?.code || '';
    this.stack = stack || error?.stack || '';
  }

  get title() {
    return `${this.name}`;
  }

  get subtitle() {
    return `${this.message}`;
  }

  get details() {
    let details = '';
    if (this.code) {
      details += `Error code: ${this.code}\n`;
    }
    if (this.stack) {
      details += `${this.stack}\n`;
    }
    
    return details;
  }

  export() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      stack: this.stack,
    };
  }

  toString() {
    return `${this.name}: ${this.message}\nCode: ${this.code}` + this.stack ? `\n\n${this.stack}` : '';
  }
}


export class AIError extends BaseError {
    constructor({error, message, code, stack, parameters, prompt}) {
      super({error, message, code, stack});
      this.name = 'AI Error';
      this.parameters = parameters;
      this.prompt = prompt;
    }

    get details() {
      let newDetails = super.details;

      if (this.prompt) {
        newDetails += `Prompt:\n---\n${this.prompt}\n\n---\n\n`;
      }
      if (this.parameters) {
        newDetails += `Parameters:\n---\n${JSON.stringify(this.parameters, null, 2)}\n\n---\n\n`;
      }
      
      return newDetails;
    }
  
    export() {
      return {
        name: this.name,
        message: this.message,
        llmParameters: this.llmParameters,
        prompt: this.prompt,
        stack: this.stack,
      };
    }

    toString() {
      return `AIError: ${this.message}\nPrompt:\n---\n${this.prompt}\n---\n\nParameters:\n---\n${JSON.stringify(this.parameters, null, 2)}\n--------------------\n`;
    }
  }

  // Lookup table by error code
  const ErrorClassLookupTable = {
    'Error': BaseError,
    'AI Error': AIError,
  };

  export function ImportError(errorFields) {
      const { name } = errorFields;
      const ErrorClass = ErrorClassLookupTable[name] || BaseError;
      const newError = new ErrorClass(errorFields);
      return newError;
  }

  export function EnsureCorrectErrorType(error) {

    if (!error) {
      return null;
    }

    if ((error instanceof BaseError)) {
      return error;
    }

    if (error instanceof Error) {
            return new BaseError({error});
    }

    // probably a struct
    return new BaseError({...error});
  }