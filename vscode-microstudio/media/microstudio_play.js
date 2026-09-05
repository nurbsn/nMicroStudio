CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
  if (w < 2 * r) {
    r = w / 2;
  }
  if (h < 2 * r) {
    r = h / 2;
  }
  this.beginPath();
  this.moveTo(x + r, y);
  this.arcTo(x + w, y, x + w, y + h, r);
  this.arcTo(x + w, y + h, x, y + h, r);
  this.arcTo(x, y + h, x, y, r);
  this.arcTo(x, y, x + w, y, r);
  return this.closePath();
};

CanvasRenderingContext2D.prototype.fillRoundRect = function(x, y, w, h, r) {
  this.roundRect(x, y, w, h, r);
  return this.fill();
};

CanvasRenderingContext2D.prototype.strokeRoundRect = function(x, y, w, h, r) {
  this.roundRect(x, y, w, h, r);
  return this.stroke();
};

var Random;

Random = (function() {
  function Random(_seed, hash) {
    this._seed = _seed != null ? _seed : Math.random();
    if (hash == null) {
      hash = true;
    }
    if (this._seed === 0) {
      this._seed = Math.random();
    }
    if (this._seed < 1) {
      this._seed *= 1 << 30;
    }
    this.a = 13971;
    this.b = 12345;
    this.size = 1 << 30;
    this.mask = this.size - 1;
    this.norm = 1 / this.size;
    if (hash) {
      this.nextSeed();
      this.nextSeed();
      this.nextSeed();
    }
  }

  Random.prototype.next = function() {
    this._seed = (this._seed * this.a + this.b) & this.mask;
    return this._seed * this.norm;
  };

  Random.prototype.nextInt = function(num) {
    return Math.floor(this.next() * num);
  };

  Random.prototype.nextSeed = function() {
    return this._seed = (this._seed * this.a + this.b) & this.mask;
  };

  Random.prototype.seed = function(_seed) {
    this._seed = _seed != null ? _seed : Math.random();
    if (this._seed < 1) {
      this._seed *= 1 << 30;
    }
    this.nextSeed();
    this.nextSeed();
    return this.nextSeed();
  };

  Random.prototype.clone = function(seed) {
    if (seed != null) {
      return new Random(seed);
    } else {
      seed = this._seed;
      return new Random(seed, false);
    }
  };

  return Random;

})();

this.Tokenizer = class Tokenizer {
  constructor(input, filename) {
    this.input = input;
    this.filename = filename;
    this.index = 0;
    this.line = 1;
    this.column = 0;
    this.last_column = 0;
    this.buffer = [];
    this.chars = {};
    this.chars["("] = Token.TYPE_OPEN_BRACE;
    this.chars[")"] = Token.TYPE_CLOSED_BRACE;
    this.chars["["] = Token.TYPE_OPEN_BRACKET;
    this.chars["]"] = Token.TYPE_CLOSED_BRACKET;
    this.chars["{"] = Token.TYPE_OPEN_CURLY_BRACE;
    this.chars["}"] = Token.TYPE_CLOSED_CURLY_BRACE;
    this.chars["^"] = Token.TYPE_POWER;
    this.chars[","] = Token.TYPE_COMMA;
    this.chars["."] = Token.TYPE_DOT;
    this.doubles = {};
    this.doubles[">"] = [Token.TYPE_GREATER, Token.TYPE_GREATER_OR_EQUALS];
    this.doubles["<"] = [Token.TYPE_LOWER, Token.TYPE_LOWER_OR_EQUALS];
    this.doubles["="] = [Token.TYPE_EQUALS, Token.TYPE_DOUBLE_EQUALS];
    this.doubles["+"] = [Token.TYPE_PLUS, Token.TYPE_PLUS_EQUALS];
    this.doubles["-"] = [Token.TYPE_MINUS, Token.TYPE_MINUS_EQUALS];
    this.doubles["*"] = [Token.TYPE_MULTIPLY, Token.TYPE_MULTIPLY_EQUALS];
    this.doubles["/"] = [Token.TYPE_DIVIDE, Token.TYPE_DIVIDE_EQUALS];
    this.doubles["%"] = [Token.TYPE_MODULO, Token.TYPE_MODULO_EQUALS];
    this.doubles["&"] = [Token.TYPE_BINARY_AND, Token.TYPE_AND_EQUALS];
    this.doubles["|"] = [Token.TYPE_BINARY_OR, Token.TYPE_OR_EQUALS];
    this.shifts = {
      "<": Token.TYPE_SHIFT_LEFT,
      ">": Token.TYPE_SHIFT_RIGHT
    };
    this.letter_regex = RegExp(/^\p{L}/, 'u');
  }

  pushBack(token) {
    return this.buffer.splice(0, 0, token);
  }

  finished() {
    return this.index >= this.input.length && this.buffer.length === 0;
  }

  nextChar(ignore_comments = false) {
    var c, endseq;
    c = this.input.charAt(this.index++);
    if (c === "\n") {
      this.line += 1;
      this.last_column = this.column;
      this.column = 0;
    } else if (c === "/" && !ignore_comments) {
      if (this.input.charAt(this.index) === "/") {
        while (true) {
          c = this.input.charAt(this.index++);
          if (c === "\n" || this.index >= this.input.length) {
            break;
          }
        }
        this.line += 1;
        this.last_column = this.column;
        this.column = 0;
        return this.nextChar();
      } else if (this.input.charAt(this.index) === "*") {
        endseq = 0;
        while (true) {
          c = this.input.charAt(this.index++);
          if (c === "\n") {
            this.line += 1;
            this.last_column = this.column;
            this.column = 0;
            endseq = 0;
          } else if (c === "*") {
            endseq = 1;
          } else if (c === "/" && endseq === 1) {
            break;
          } else {
            endseq = 0;
          }
          if (this.index >= this.input.length) {
            break;
          }
        }
        return this.nextChar();
      }
    } else {
      this.column += 1;
    }
    return c;
  }

  rewind() {
    this.index -= 1;
    this.column -= 1;
    if (this.input.charAt(this.index) === "\n") {
      this.line -= 1;
      return this.column = this.last_column;
    }
  }

  next() {
    var c, code;
    if (this.buffer.length > 0) {
      return this.buffer.splice(0, 1)[0];
    }
    while (true) {
      if (this.index >= this.input.length) {
        return null;
      }
      c = this.nextChar();
      code = c.charCodeAt(0);
      if (code > 32 && code !== 160) {
        break;
      }
    }
    this.token_start = this.index - 1;
    if (this.doubles[c] != null) {
      return this.parseDouble(c, this.doubles[c]);
    }
    if (this.chars[c] != null) {
      return new Token(this, this.chars[c], c);
    }
    if (c === "!") {
      return this.parseUnequals(c);
    } else if (code >= 48 && code <= 57) {
      return this.parseNumber(c);
    } else if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95 || this.letter_regex.test(c)) {
      return this.parseIdentifier(c);
    } else if (c === '"') {
      return this.parseString(c, '"');
    } else if (c === "'") {
      return this.parseString(c, "'");
    } else {
      return this.error("Syntax Error");
    }
  }

  changeNumberToIdentifier() {
    var i, j, ref, results, token, v;
    token = this.next();
    if ((token != null) && token.type === Token.TYPE_NUMBER) {
      v = token.string_value.split(".");
      results = [];
      for (i = j = ref = v.length - 1; j >= 0; i = j += -1) {
        if (v[i].length > 0) {
          this.pushBack(new Token(this, Token.TYPE_IDENTIFIER, v[i]));
        }
        if (i > 0) {
          results.push(this.pushBack(new Token(this, Token.TYPE_DOT, ".")));
        } else {
          results.push(void 0);
        }
      }
      return results;
    } else if ((token != null) && token.type === Token.TYPE_STRING) {
      return this.pushBack(new Token(this, Token.TYPE_IDENTIFIER, token.value));
    } else {
      return this.pushBack(token);
    }
  }

  parseDouble(c, d) {
    if ((this.shifts[c] != null) && this.index < this.input.length && this.input.charAt(this.index) === c) {
      this.nextChar();
      return new Token(this, this.shifts[c], c + c);
    } else if (this.index < this.input.length && this.input.charAt(this.index) === "=") {
      this.nextChar();
      return new Token(this, d[1], c + "=");
    } else {
      return new Token(this, d[0], c);
    }
  }

  parseEquals(c) {
    if (this.index < this.input.length && this.input.charAt(this.index) === "=") {
      this.nextChar();
      return new Token(this, Token.TYPE_DOUBLE_EQUALS, "==");
    } else {
      return new Token(this, Token.TYPE_EQUALS, "=");
    }
  }

  parseGreater(c) {
    if (this.index < this.input.length && this.input.charAt(this.index) === "=") {
      this.nextChar();
      return new Token(this, Token.TYPE_GREATER_OR_EQUALS, ">=");
    } else {
      return new Token(this, Token.TYPE_GREATER_OR_EQUALS, ">");
    }
  }

  parseLower(c) {
    if (this.index < this.input.length && this.input.charAt(this.index) === "=") {
      this.nextChar();
      return new Token(this, Token.TYPE_LOWER_OR_EQUALS, "<=");
    } else {
      return new Token(this, Token.TYPE_LOWER, "<");
    }
  }

  parseUnequals(c) {
    if (this.index < this.input.length && this.input.charAt(this.index) === "=") {
      this.nextChar();
      return new Token(this, Token.TYPE_UNEQUALS, "!=");
    } else {
      return this.error("Expected inequality !=");
    }
  }

  parseIdentifier(s) {
    var c, code;
    while (true) {
      if (this.index >= this.input.length) {
        return new Token(this, Token.TYPE_IDENTIFIER, s);
      }
      c = this.nextChar();
      code = c.charCodeAt(0);
      if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 95 || (code >= 48 && code <= 57) || this.letter_regex.test(c)) {
        s += c;
      } else {
        this.rewind();
        return new Token(this, Token.TYPE_IDENTIFIER, s);
      }
    }
  }

  parseNumber(s) {
    var c, code, exp, pointed;
    pointed = false;
    exp = false;
    while (true) {
      if (this.index >= this.input.length) {
        return new Token(this, Token.TYPE_NUMBER, Number.parseFloat(s), s);
      }
      c = this.nextChar();
      code = c.charCodeAt(0);
      if (c === "." && !pointed && !exp) {
        pointed = true;
        s += c;
      } else if (code >= 48 && code <= 57) {
        s += c;
      } else if ((c === "e" || c === "E") && !exp && this.index < this.input.length) {
        exp = true;
        s += c;
        c = this.nextChar();
        if (c === "+" || c === "-") {
          s += c;
        } else {
          this.rewind();
        }
      } else if ((c === "x" || c === "X") && s === "0") {
        return this.parseHexNumber("0x");
      } else {
        this.rewind();
        return new Token(this, Token.TYPE_NUMBER, Number.parseFloat(s), s);
      }
    }
  }

  parseHexNumber(s) {
    var c;
    while (true) {
      if (this.index >= this.input.length) {
        return new Token(this, Token.TYPE_NUMBER, Number.parseInt(s), s);
      }
      c = this.nextChar();
      if (/[a-fA-F0-9]/.test(c)) {
        s += c;
      } else {
        this.rewind();
        return new Token(this, Token.TYPE_NUMBER, Number.parseInt(s), s);
      }
    }
  }

  parseString(s, close = '"') {
    var c, code, count_close, n;
    if (close === '"') {
      if (this.input.charAt(this.index) === '"' && this.input.charAt(this.index + 1) === '"' && this.input.charAt(this.index + 2) !== '"') {
        close = '"""';
        this.nextChar(true);
        this.nextChar(true);
      }
    }
    count_close = 0;
    while (true) {
      if (this.index >= this.input.length) {
        return this.error("Unclosed string value");
      }
      c = this.nextChar(true);
      code = c.charCodeAt(0);
      if (c === "\\") {
        n = this.nextChar(true);
        switch (n) {
          case "n":
            s += "\n";
            break;
          case "\\":
            s += "\\";
            break;
          case close:
            s += close;
            break;
          default:
            s += "\\" + n;
        }
      } else if (c === close) {
        n = this.nextChar(true);
        if (n === close) {
          s += c;
        } else {
          this.rewind();
          s += c;
          return new Token(this, Token.TYPE_STRING, s.substring(1, s.length - 1));
        }
      } else {
        if (close === '"""' && c === '"') {
          count_close += 1;
          if (count_close === 3) {
            return new Token(this, Token.TYPE_STRING, s.substring(1, s.length - 2));
          }
        } else {
          count_close = 0;
        }
        s += c;
      }
    }
  }

  error(s) {
    throw s;
  }

};

this.Token = class Token {
  constructor(tokenizer, type, value, string_value) {
    this.tokenizer = tokenizer;
    this.type = type;
    this.value = value;
    this.string_value = string_value;
    this.line = this.tokenizer.line;
    this.column = this.tokenizer.column;
    this.start = this.tokenizer.token_start;
    this.length = this.tokenizer.index - this.start;
    this.index = this.tokenizer.index;
    if (this.type === Token.TYPE_IDENTIFIER && Token.predefined.hasOwnProperty(this.value)) {
      this.type = Token.predefined[this.value];
      this.reserved_keyword = true;
    }
    this.is_binary_operator = (this.type >= 30 && this.type <= 39) || (this.type >= 200 && this.type <= 201) || (this.type >= 2 && this.type <= 7);
  }

  toString() {
    return this.value + " : " + this.type;
  }

};

this.Token.TYPE_EQUALS = 1;

this.Token.TYPE_DOUBLE_EQUALS = 2;

this.Token.TYPE_GREATER = 3;

this.Token.TYPE_GREATER_OR_EQUALS = 4;

this.Token.TYPE_LOWER = 5;

this.Token.TYPE_LOWER_OR_EQUALS = 6;

this.Token.TYPE_UNEQUALS = 7;

this.Token.TYPE_IDENTIFIER = 10;

this.Token.TYPE_NUMBER = 11;

this.Token.TYPE_STRING = 12;

this.Token.TYPE_OPEN_BRACE = 20;

this.Token.TYPE_CLOSED_BRACE = 21;

// @Token.TYPE_OPEN_CURLY_BRACE = 22
// @Token.TYPE_CLOSED_CURLY_BRACE = 23
this.Token.TYPE_OPEN_BRACKET = 24;

this.Token.TYPE_CLOSED_BRACKET = 25;

this.Token.TYPE_COMMA = 26;

this.Token.TYPE_DOT = 27;

this.Token.TYPE_PLUS = 30;

this.Token.TYPE_MINUS = 31;

this.Token.TYPE_MULTIPLY = 32;

this.Token.TYPE_DIVIDE = 33;

this.Token.TYPE_POWER = 34;

this.Token.TYPE_MODULO = 35;

this.Token.TYPE_BINARY_AND = 36;

this.Token.TYPE_BINARY_OR = 37;

this.Token.TYPE_SHIFT_LEFT = 38;

this.Token.TYPE_SHIFT_RIGHT = 39;

this.Token.TYPE_PLUS_EQUALS = 40;

this.Token.TYPE_MINUS_EQUALS = 41;

this.Token.TYPE_MULTIPLY_EQUALS = 42;

this.Token.TYPE_DIVIDE_EQUALS = 43;

this.Token.TYPE_MODULO_EQUALS = 44;

this.Token.TYPE_AND_EQUALS = 45;

this.Token.TYPE_OR_EQUALS = 46;

this.Token.TYPE_RETURN = 50;

this.Token.TYPE_BREAK = 51;

this.Token.TYPE_CONTINUE = 52;

this.Token.TYPE_FUNCTION = 60;

this.Token.TYPE_AFTER = 61;

this.Token.TYPE_EVERY = 62;

this.Token.TYPE_DO = 63;

this.Token.TYPE_SLEEP = 64;

this.Token.TYPE_LOCAL = 70;

this.Token.TYPE_OBJECT = 80;

this.Token.TYPE_CLASS = 90;

this.Token.TYPE_EXTENDS = 91;

this.Token.TYPE_NEW = 92;

this.Token.TYPE_FOR = 100;

this.Token.TYPE_TO = 101;

this.Token.TYPE_BY = 102;

this.Token.TYPE_IN = 103;

this.Token.TYPE_WHILE = 104;

this.Token.TYPE_IF = 105;

this.Token.TYPE_THEN = 106;

this.Token.TYPE_ELSE = 107;

this.Token.TYPE_ELSIF = 108;

this.Token.TYPE_END = 120;

this.Token.TYPE_AND = 200;

this.Token.TYPE_OR = 201;

this.Token.TYPE_NOT = 202;

this.Token.TYPE_ERROR = 404;

this.Token.predefined = {};

this.Token.predefined["return"] = this.Token.TYPE_RETURN;

this.Token.predefined["break"] = this.Token.TYPE_BREAK;

this.Token.predefined["continue"] = this.Token.TYPE_CONTINUE;

this.Token.predefined["function"] = this.Token.TYPE_FUNCTION;

this.Token.predefined["for"] = this.Token.TYPE_FOR;

this.Token.predefined["to"] = this.Token.TYPE_TO;

this.Token.predefined["by"] = this.Token.TYPE_BY;

this.Token.predefined["in"] = this.Token.TYPE_IN;

this.Token.predefined["while"] = this.Token.TYPE_WHILE;

this.Token.predefined["if"] = this.Token.TYPE_IF;

this.Token.predefined["then"] = this.Token.TYPE_THEN;

this.Token.predefined["else"] = this.Token.TYPE_ELSE;

this.Token.predefined["elsif"] = this.Token.TYPE_ELSIF;

this.Token.predefined["end"] = this.Token.TYPE_END;

this.Token.predefined["object"] = this.Token.TYPE_OBJECT;

this.Token.predefined["class"] = this.Token.TYPE_CLASS;

this.Token.predefined["extends"] = this.Token.TYPE_EXTENDS;

this.Token.predefined["new"] = this.Token.TYPE_NEW;

this.Token.predefined["and"] = this.Token.TYPE_AND;

this.Token.predefined["or"] = this.Token.TYPE_OR;

this.Token.predefined["not"] = this.Token.TYPE_NOT;

this.Token.predefined["after"] = this.Token.TYPE_AFTER;

this.Token.predefined["every"] = this.Token.TYPE_EVERY;

this.Token.predefined["do"] = this.Token.TYPE_DO;

this.Token.predefined["sleep"] = this.Token.TYPE_SLEEP;

this.Token.predefined["delete"] = this.Token.TYPE_DELETE;

this.Token.predefined["local"] = this.Token.TYPE_LOCAL;

this.Parser = (function() {
  class Parser {
    constructor(input, filename = "") {
      this.input = input;
      this.filename = filename;
      if (/^\s*\/\/\s*javascript\s*\n/.test(this.input)) {
        this.input = 'system.javascript("""\n\n' + this.input.replace(/\\/g, "\\\\") + '\n\n""")';
      }
      this.tokenizer = new Tokenizer(this.input, this.filename);
      this.program = new Program();
      this.current_block = [];
      this.current = {
        line: 1,
        column: 1
      };
      this.verbose = false;
      this.nesting = 0;
      this.object_nesting = 0;
      this.not_terminated = [];
      this.api_reserved = {
        screen: true,
        audio: true,
        keyboard: true,
        gamepad: true,
        sprites: true,
        sounds: true,
        music: true,
        assets: true,
        asset_manager: true,
        maps: true,
        touch: true,
        mouse: true,
        fonts: true,
        Sound: true,
        Image: true,
        Sprite: true,
        Map: true,
        system: true,
        storage: true,
        print: true,
        random: true,
        Function: true,
        List: true,
        Object: true,
        String: true,
        Number: true
      };
    }

    nextToken() {
      var token;
      token = this.tokenizer.next();
      if (token == null) {
        this.unexpected_eof = true;
        throw "Unexpected end of file";
      }
      return this.current = token;
    }

    nextTokenOptional() {
      var token;
      token = this.tokenizer.next();
      if (token != null) {
        this.current = token;
      }
      return token;
    }

    parse() {
      var err, expression, nt, token;
      try {
        this.warnings = [];
        while (true) {
          expression = this.parseLine();
          if ((expression == null) && !this.tokenizer.finished()) {
            token = this.tokenizer.next();
            if ((token != null) && token.reserved_keyword) {
              if (token.value === "end") {
                this.error("Too many 'end'");
              } else {
                this.error(`Misuse of reserved keyword: '${token.value}'`);
              }
            } else {
              this.error("Unexpected data");
            }
          }
          if (expression === null) {
            break;
          }
          this.current_block.push(expression);
          this.program.add(expression);
          if (this.verbose) {
            console.info(expression);
          }
        }
        return this;
      } catch (error1) {
        err = error1;
        //console.info "Error at line: #{@current.line} column: #{@current.column}"
        if (this.not_terminated.length > 0 && err === "Unexpected end of file") {
          nt = this.not_terminated[this.not_terminated.length - 1];
          return this.error_info = {
            error: `Unterminated '${nt.value}' ; no matching 'end' found`,
            line: nt.line,
            column: nt.column
          };
        } else {
          return this.error_info = {
            error: err,
            line: this.current.line,
            column: this.current.column
          };
        }
      }
    }

    //console.error err
    parseLine() {
      var token;
      token = this.nextTokenOptional();
      if (token == null) {
        return null;
      }
      switch (token.type) {
        case Token.TYPE_RETURN:
          return new Program.Return(token, this.parseExpression());
        case Token.TYPE_BREAK:
          return new Program.Break(token);
        case Token.TYPE_CONTINUE:
          return new Program.Continue(token);
        case Token.TYPE_LOCAL:
          return this.parseLocalAssignment(token);
        default:
          this.tokenizer.pushBack(token);
          return this.parseExpression();
      }
    }

    parseExpression(filter, first_function_call = false) {
      var access, expression;
      expression = this.parseExpressionStart();
      if (expression == null) {
        return null;
      }
      while (true) {
        access = this.parseExpressionSuffix(expression, filter);
        if (access == null) {
          return expression;
        }
        if (first_function_call && access instanceof Program.FunctionCall) {
          return access;
        }
        expression = access;
      }
    }

    assertExpression(filter, first_function_call = false) {
      var exp;
      exp = this.parseExpression(filter, first_function_call);
      if (exp == null) {
        throw "Expression expected";
      }
      return exp;
    }

    parseExpressionSuffix(expression, filter) {
      var field, identifier, token;
      token = this.nextTokenOptional();
      if (token == null) {
        return (filter === "self" ? expression : null);
      }
      switch (token.type) {
        case Token.TYPE_DOT:
          if (expression instanceof Program.Value && expression.type === Program.Value.TYPE_NUMBER) {
            this.tokenizer.pushBack(token);
            return null;
          } else {
            this.tokenizer.changeNumberToIdentifier();
            identifier = this.assertBroadIdentifier("Expected identifier");
            return Program.CreateFieldAccess(token, expression, new Program.Value(identifier, Program.Value.TYPE_STRING, identifier.value));
          }
          break;
        case Token.TYPE_OPEN_BRACKET:
          field = this.assertExpression();
          this.assert(Token.TYPE_CLOSED_BRACKET, "Expected ']'");
          return Program.CreateFieldAccess(token, expression, field);
        case Token.TYPE_OPEN_BRACE:
          return this.parseFunctionCall(token, expression);
        case Token.TYPE_EQUALS:
          return this.parseAssignment(token, expression);
        case Token.TYPE_PLUS_EQUALS:
          return this.parseSelfAssignment(token, expression, token.type);
        case Token.TYPE_MINUS_EQUALS:
          return this.parseSelfAssignment(token, expression, token.type);
        case Token.TYPE_MULTIPLY_EQUALS:
          return this.parseSelfAssignment(token, expression, token.type);
        case Token.TYPE_DIVIDE_EQUALS:
          return this.parseSelfAssignment(token, expression, token.type);
        case Token.TYPE_MODULO_EQUALS:
        case Token.TYPE_AND_EQUALS:
        case Token.TYPE_OR_EQUALS:
          return this.parseSelfAssignment(token, expression, token.type);
        default:
          if (filter === "self") {
            this.tokenizer.pushBack(token);
            return expression;
          } else if (token.is_binary_operator && filter !== "noop") {
            return this.parseBinaryOperation(token, expression);
          } else {
            this.tokenizer.pushBack(token);
            return null;
          }
      }
    }

    parseExpressionStart() {
      var next, token;
      token = this.nextTokenOptional();
      if (token == null) {
        return null;
      }
      switch (token.type) {
        case Token.TYPE_IDENTIFIER: // variable name
          return new Program.Variable(token, token.value);
        case Token.TYPE_NUMBER:
          return this.parseNumberExpression(token);
        case Token.TYPE_PLUS:
          return this.assertExpression();
        case Token.TYPE_MINUS:
          return this.parseExpressionSuffix(new Program.Negate(token, this.assertExpression("noop")), "self");
        case Token.TYPE_NOT:
          return this.parseExpressionSuffix(new Program.Not(token, this.assertExpression("noop")), "self");
        case Token.TYPE_STRING:
          return this.parseStringExpression(token);
        case Token.TYPE_IF:
          return this.parseIf(token);
        case Token.TYPE_FOR:
          return this.parseFor(token);
        case Token.TYPE_WHILE:
          return this.parseWhile(token);
        case Token.TYPE_OPEN_BRACE:
          return this.parseBracedExpression(token);
        case Token.TYPE_OPEN_BRACKET:
          return this.parseArray(token);
        case Token.TYPE_FUNCTION:
          return this.parseFunction(token);
        case Token.TYPE_OBJECT:
          return this.parseObject(token);
        case Token.TYPE_CLASS:
          return this.parseClass(token);
        case Token.TYPE_NEW:
          return this.parseNew(token);
        case Token.TYPE_DOT:
          next = this.assert(Token.TYPE_NUMBER, "malformed number");
          if (!Number.isInteger(next.value)) {
            throw "malformed number";
          }
          return new Program.Value(token, Program.Value.TYPE_NUMBER, Number.parseFloat(`.${next.string_value}`));
        case Token.TYPE_AFTER:
          return this.parseAfter(token);
        case Token.TYPE_EVERY:
          return this.parseEvery(token);
        case Token.TYPE_DO:
          return this.parseDo(token);
        case Token.TYPE_SLEEP:
          return this.parseSleep(token);
        case Token.TYPE_DELETE:
          return this.parseDelete(token);
        default:
          this.tokenizer.pushBack(token);
          return null;
      }
    }

    parseNumberExpression(number) {
      return new Program.Value(number, Program.Value.TYPE_NUMBER, number.value);
    }

    parseStringExpression(string) {
      var token;
      token = this.nextTokenOptional();
      if (token == null) {
        return new Program.Value(string, Program.Value.TYPE_STRING, string.value);
      } else {
        this.tokenizer.pushBack(token);
        return new Program.Value(string, Program.Value.TYPE_STRING, string.value);
      }
    }

    parseArray(bracket) {
      var res, token;
      res = [];
      while (true) {
        token = this.nextToken();
        if (token.type === Token.TYPE_CLOSED_BRACKET) {
          return new Program.Value(bracket, Program.Value.TYPE_ARRAY, res);
        } else if (token.type === Token.TYPE_COMMA) {
          continue;
        } else {
          this.tokenizer.pushBack(token);
          res.push(this.assertExpression());
        }
      }
    }

    parseBinaryOperation(operation, term1) {
      var ops, terms, token;
      ops = [new Program.Operation(operation, operation.value)];
      terms = [term1];
      terms.push(this.assertExpression("noop"));
      while (true) {
        token = this.nextTokenOptional();
        if (token == null) {
          break;
        }
        if (!token.is_binary_operator) {
          this.tokenizer.pushBack(token);
          break;
        }
        ops.push(new Program.Operation(token, token.value));
        terms.push(this.assertExpression("noop"));
      }
      return Program.BuildOperations(ops, terms);
    }

    parseAssignment(token, expression) {
      var res;
      if (!(expression instanceof Program.Variable) && !(expression instanceof Program.Field)) {
        throw "Expected variable identifier or property";
      }
      if (this.object_nesting === 0 && expression instanceof Program.Variable && this.api_reserved[expression.identifier]) {
        this.warnings.push({
          type: "assigning_api_variable",
          identifier: expression.identifier,
          line: token.line,
          column: token.column
        });
      }
      if (expression instanceof Program.Field) {
        this.object_nesting += 1;
        res = new Program.Assignment(token, expression, this.assertExpression());
        this.object_nesting -= 1;
      } else {
        res = new Program.Assignment(token, expression, this.assertExpression());
      }
      return res;
    }

    parseSelfAssignment(token, expression, operation) {
      if (!(expression instanceof Program.Variable) && !(expression instanceof Program.Field)) {
        throw "Expected variable identifier or property";
      }
      return new Program.SelfAssignment(token, expression, operation, this.assertExpression());
    }

    parseLocalAssignment(local) {
      var identifier;
      identifier = this.assert(Token.TYPE_IDENTIFIER, "Expected identifier");
      this.assert(Token.TYPE_EQUALS, "Expected '='");
      return new Program.Assignment(local, new Program.Variable(identifier, identifier.value), this.assertExpression(), true);
    }

    parseBracedExpression(open) {
      var expression, token;
      expression = this.assertExpression();
      token = this.nextToken();
      if (token.type === Token.TYPE_CLOSED_BRACE) {
        return new Program.Braced(open, expression);
      } else {
        return this.error("missing closing parenthese");
      }
    }

    parseFunctionCall(brace_token, expression) {
      var args, start, token;
      args = [];
      this.last_function_call = new Program.FunctionCall(brace_token, expression, args);
      this.last_function_call.argslimits = [];
      while (true) {
        token = this.nextTokenOptional();
        if (token == null) {
          return this.error("missing closing parenthese");
        } else if (token.type === Token.TYPE_CLOSED_BRACE) {
          return new Program.FunctionCall(token, expression, args);
        } else if (token.type === Token.TYPE_COMMA) {
          continue;
        } else {
          this.tokenizer.pushBack(token);
          start = token.start;
          args.push(this.assertExpression());
          this.last_function_call.argslimits.push({
            start: start,
            end: this.tokenizer.index - 1
          });
        }
      }
    }

    addTerminable(token) {
      return this.not_terminated.push(token);
    }

    endTerminable() {
      if (this.not_terminated.length > 0) {
        this.not_terminated.splice(this.not_terminated.length - 1, 1);
      }
    }

    parseFunction(funk) {
      var args, line, sequence, token;
      this.nesting += 1;
      this.addTerminable(funk);
      args = this.parseFunctionArgs();
      sequence = [];
      while (true) {
        token = this.nextToken();
        if (token.type === Token.TYPE_END) {
          this.nesting -= 1;
          this.endTerminable();
          return new Program.Function(funk, args, sequence, token);
        } else {
          this.tokenizer.pushBack(token);
          line = this.parseLine();
          if (line != null) {
            sequence.push(line);
          } else {
            this.error("Unexpected data while parsing function");
          }
        }
      }
    }

    parseFunctionArgs() {
      var args, exp, last, token;
      token = this.nextToken();
      args = [];
      last = null;
      if (token.type !== Token.TYPE_OPEN_BRACE) {
        return this.error("Expected opening parenthese");
      }
      while (true) {
        token = this.nextToken();
        if (token.type === Token.TYPE_CLOSED_BRACE) {
          return args;
        } else if (token.type === Token.TYPE_COMMA) {
          last = null;
          continue;
        } else if (token.type === Token.TYPE_EQUALS && last === "argument") {
          exp = this.assertExpression();
          args[args.length - 1].default = exp;
        } else if (token.type === Token.TYPE_IDENTIFIER) {
          last = "argument";
          args.push({
            name: token.value
          });
        } else {
          return this.error("Unexpected token");
        }
      }
    }

    warningAssignmentCondition(expression) {
      if (expression instanceof Program.Assignment) {
        return this.warnings.push({
          type: "assignment_as_condition",
          line: expression.token.line,
          column: expression.token.column
        });
      }
    }

    parseIf(iftoken) {
      var chain, current, line, token;
      this.addTerminable(iftoken);
      current = {
        condition: this.assertExpression(),
        sequence: []
      };
      this.warningAssignmentCondition(current.condition);
      chain = [];
      token = this.nextToken();
      if (token.type !== Token.TYPE_THEN) {
        return this.error("Expected 'then'");
      }
      while (true) {
        token = this.nextToken();
        if (token.type === Token.TYPE_ELSIF) {
          chain.push(current);
          current = {
            condition: this.assertExpression(),
            sequence: []
          };
          this.warningAssignmentCondition(current.condition);
          this.assert(Token.TYPE_THEN, "Expected 'then'");
        } else if (token.type === Token.TYPE_ELSE) {
          current.else = [];
        } else if (token.type === Token.TYPE_END) {
          chain.push(current);
          this.endTerminable();
          return new Program.Condition(iftoken, chain);
        } else {
          this.tokenizer.pushBack(token);
          line = this.parseLine();
          if (line == null) {
            throw Error("Unexpected data while parsing if");
          }
          if (current.else != null) {
            current.else.push(line);
          } else {
            current.sequence.push(line);
          }
        }
      }
    }

    assert(type, error) {
      var token;
      token = this.nextToken();
      if (token.type !== type) {
        throw error;
      }
      return token;
    }

    assertBroadIdentifier(error) {
      var token;
      token = this.nextToken();
      if (token.type !== Token.TYPE_IDENTIFIER && token.reserved_keyword) {
        token.type = Token.TYPE_IDENTIFIER;
      }
      if (token.type !== Token.TYPE_IDENTIFIER) {
        throw error;
      }
      return token;
    }

    error(text) {
      throw text;
    }

    parseFor(fortoken) {
      var iterator, list, range_by, range_from, range_to, token;
      iterator = this.assertExpression();
      if (iterator instanceof Program.Assignment) {
        range_from = iterator.expression;
        iterator = iterator.field;
        token = this.nextToken();
        if (token.type !== Token.TYPE_TO) {
          return this.error("Expected 'to'");
        }
        range_to = this.assertExpression();
        token = this.nextToken();
        if (token.type === Token.TYPE_BY) {
          range_by = this.assertExpression();
        } else {
          range_by = 0;
          this.tokenizer.pushBack(token);
        }
        return new Program.For(fortoken, iterator.identifier, range_from, range_to, range_by, this.parseSequence(fortoken));
      } else if (iterator instanceof Program.Variable) {
        this.assert(Token.TYPE_IN, "Error expected keyword 'in'");
        list = this.assertExpression();
        return new Program.ForIn(fortoken, iterator.identifier, list, this.parseSequence(fortoken));
      } else {
        return this.error("Malformed for loop");
      }
    }

    parseWhile(whiletoken) {
      var condition;
      condition = this.assertExpression();
      return new Program.While(whiletoken, condition, this.parseSequence(whiletoken));
    }

    parseSequence(start_token) {
      var line, sequence, token;
      if (start_token != null) {
        this.addTerminable(start_token);
      }
      this.nesting += 1;
      sequence = [];
      while (true) {
        token = this.nextToken();
        if (token.type === Token.TYPE_END) {
          if (start_token != null) {
            this.endTerminable();
          }
          this.nesting -= 1;
          return sequence;
        } else {
          this.tokenizer.pushBack(token);
          line = this.parseLine();
          if (line == null) {
            this.error("Unexpected data");
          }
          sequence.push(line);
        }
      }
      return sequence;
    }

    parseObject(object) {
      var exp, fields, token;
      this.nesting += 1;
      this.object_nesting += 1;
      this.addTerminable(object);
      fields = [];
      while (true) {
        token = this.nextToken();
        if (token.type === Token.TYPE_END) {
          this.nesting -= 1;
          this.object_nesting -= 1;
          this.endTerminable();
          return new Program.CreateObject(object, fields);
        } else {
          if (token.type !== Token.TYPE_IDENTIFIER && token.reserved_keyword) {
            token.type = Token.TYPE_IDENTIFIER;
          }
          if (token.type === Token.TYPE_STRING) {
            token.type = Token.TYPE_IDENTIFIER;
          }
          if (token.type === Token.TYPE_IDENTIFIER) {
            this.assert(Token.TYPE_EQUALS, "Expected '='");
            exp = this.assertExpression();
            fields.push({
              field: token.value,
              value: exp
            });
          } else {
            return this.error("Malformed object");
          }
        }
      }
    }

    parseClass(object) {
      var exp, ext, fields, token;
      this.nesting += 1;
      this.object_nesting += 1;
      this.addTerminable(object);
      fields = [];
      token = this.nextToken();
      if (token.type === Token.TYPE_EXTENDS) {
        ext = this.assertExpression();
        token = this.nextToken();
      }
      while (true) {
        if (token.type === Token.TYPE_END) {
          this.nesting -= 1;
          this.object_nesting -= 1;
          this.endTerminable();
          return new Program.CreateClass(object, ext, fields);
        } else {
          if (token.type !== Token.TYPE_IDENTIFIER && token.reserved_keyword) {
            token.type = Token.TYPE_IDENTIFIER;
          }
          if (token.type === Token.TYPE_STRING) {
            token.type = Token.TYPE_IDENTIFIER;
          }
          if (token.type === Token.TYPE_IDENTIFIER) {
            this.assert(Token.TYPE_EQUALS, "Expected '='");
            exp = this.assertExpression();
            fields.push({
              field: token.value,
              value: exp
            });
          } else {
            return this.error("Malformed object");
          }
        }
        token = this.nextToken();
      }
    }

    parseNew(token) {
      var exp;
      exp = this.assertExpression(null, true);
      return new Program.NewCall(token, exp);
    }

    parseAfter(after) {
      var delay, line, multiplier, sequence, token;
      this.nesting += 1;
      this.addTerminable(after);
      delay = this.assertExpression();
      token = this.nextToken();
      multiplier = null;
      if (token.type === Token.TYPE_IDENTIFIER && this.multipliers[token.value]) {
        multiplier = this.multipliers[token.value];
        token = this.nextToken();
      }
      if ((token == null) || token.type !== Token.TYPE_DO) {
        this.error("Expected keyword 'do'");
      }
      sequence = [];
      while (true) {
        token = this.nextToken();
        if (token.type === Token.TYPE_END) {
          this.nesting -= 1;
          this.endTerminable();
          return new Program.After(after, delay, sequence, token, multiplier);
        } else {
          this.tokenizer.pushBack(token);
          line = this.parseLine();
          if (line != null) {
            sequence.push(line);
          } else {
            this.error("Unexpected data while parsing after");
          }
        }
      }
    }

    parseEvery(every) {
      var delay, line, multiplier, sequence, token;
      this.nesting += 1;
      this.addTerminable(every);
      delay = this.assertExpression();
      token = this.nextToken();
      multiplier = null;
      if (token.type === Token.TYPE_IDENTIFIER && this.multipliers[token.value]) {
        multiplier = this.multipliers[token.value];
        token = this.nextToken();
      }
      if ((token == null) || token.type !== Token.TYPE_DO) {
        this.error("Expected keyword 'do'");
      }
      sequence = [];
      while (true) {
        token = this.nextToken();
        if (token.type === Token.TYPE_END) {
          this.nesting -= 1;
          this.endTerminable();
          return new Program.Every(every, delay, sequence, token, multiplier);
        } else {
          this.tokenizer.pushBack(token);
          line = this.parseLine();
          if (line != null) {
            sequence.push(line);
          } else {
            this.error("Unexpected data while parsing after");
          }
        }
      }
    }

    parseDo(do_token) {
      var line, sequence, token;
      this.nesting += 1;
      this.addTerminable(do_token);
      sequence = [];
      while (true) {
        token = this.nextToken();
        if (token.type === Token.TYPE_END) {
          this.nesting -= 1;
          this.endTerminable();
          return new Program.Do(do_token, sequence, token);
        } else {
          this.tokenizer.pushBack(token);
          line = this.parseLine();
          if (line != null) {
            sequence.push(line);
          } else {
            this.error("Unexpected data while parsing after");
          }
        }
      }
    }

    parseSleep(sleep) {
      var delay, multiplier, token;
      delay = this.assertExpression();
      token = this.nextToken();
      multiplier = null;
      if (token != null) {
        if (token.type === Token.TYPE_IDENTIFIER && this.multipliers[token.value]) {
          multiplier = this.multipliers[token.value];
        } else {
          this.tokenizer.pushBack(token);
        }
      }
      return new Program.Sleep(sleep, delay, multiplier);
    }

    parseDelete(del) {
      var v;
      v = this.parseExpression();
      if ((v == null) || (!(v instanceof Program.Variable) && !(v instanceof Program.Field))) {
        return this.error("expecting variable name or property access after keyword `delete`");
      } else {
        return new Program.Delete(del, v);
      }
    }

  };

  Parser.prototype.multipliers = {
    millisecond: 1,
    milliseconds: 1,
    second: 1000,
    seconds: 1000,
    minute: 60000,
    minutes: 60000,
    hour: 60000 * 60,
    hours: 60000 * 60,
    day: 60000 * 60 * 24,
    days: 60000 * 60 * 24
  };

  return Parser;

}).call(this);

this.Program = class Program {
  constructor() {
    this.statements = [];
  }

  add(statement) {
    return this.statements.push(statement);
  }

  isAssignment() {
    return this.statements.length > 0 && this.statements[this.statements.length - 1] instanceof Program.Assignment;
  }

};

this.Program.Expression = class Expression {
  constructor() {}

};

this.Program.Assignment = class Assignment {
  constructor(token1, field1, expression1, local) {
    this.token = token1;
    this.field = field1;
    this.expression = expression1;
    this.local = local;
  }

};

this.Program.SelfAssignment = class SelfAssignment {
  constructor(token1, field1, operation, expression1) {
    this.token = token1;
    this.field = field1;
    this.operation = operation;
    this.expression = expression1;
  }

};

this.Program.Value = (function() {
  class Value {
    constructor(token1, type, value1) {
      this.token = token1;
      this.type = type;
      this.value = value1;
    }

  };

  Value.TYPE_NUMBER = 1;

  Value.TYPE_STRING = 2;

  Value.TYPE_ARRAY = 3;

  Value.TYPE_OBJECT = 4;

  Value.TYPE_FUNCTION = 5;

  Value.TYPE_CLASS = 6;

  return Value;

}).call(this);

this.Program.CreateFieldAccess = function(token, expression, field) {
  if (expression instanceof Program.Field) {
    expression.appendField(field);
    return expression;
  } else {
    return new Program.Field(token, expression, [field]);
  }
};

this.Program.Variable = class Variable {
  constructor(token1, identifier) {
    this.token = token1;
    this.identifier = identifier;
  }

};

this.Program.Field = class Field {
  constructor(token1, expression1, chain) {
    this.token = token1;
    this.expression = expression1;
    this.chain = chain;
    this.token = this.expression.token;
  }

  appendField(field) {
    return this.chain.push(field);
  }

};

this.Program.BuildOperations = function(ops, terms) {
  var i, o, o1, o2, prec, t1, t2;
  while (ops.length > 1) {
    i = 0;
    prec = 0;
    while (i < ops.length - 1) {
      o1 = ops[i];
      o2 = ops[i + 1];
      if (Program.Precedence[o2.operation] <= Program.Precedence[o1.operation]) {
        break;
      }
      i++;
    }
    t1 = terms[i];
    t2 = terms[i + 1];
    o = new Program.Operation(ops[i].token, ops[i].operation, t1, t2);
    terms.splice(i, 2, o);
    ops.splice(i, 1);
  }
  return new Program.Operation(ops[0].token, ops[0].operation, terms[0], terms[1]);
};

this.Program.Operation = class Operation {
  constructor(token1, operation, term1, term2) {
    this.token = token1;
    this.operation = operation;
    this.term1 = term1;
    this.term2 = term2;
  }

};

this.Program.Negate = class Negate {
  constructor(token1, expression1) {
    this.token = token1;
    this.expression = expression1;
  }

};

this.Program.Not = class Not {
  constructor(token1, expression1) {
    this.token = token1;
    this.expression = expression1;
  }

};

this.Program.Braced = class Braced {
  constructor(token1, expression1) {
    this.token = token1;
    this.expression = expression1;
  }

};

this.Program.Return = class Return {
  constructor(token1, expression1) {
    this.token = token1;
    this.expression = expression1;
  }

};

this.Program.Condition = class Condition {
  constructor(token1, chain) {
    this.token = token1;
    this.chain = chain;
  }

};

this.Program.For = class For {
  constructor(token1, iterator, range_from, range_to, range_by, sequence) {
    this.token = token1;
    this.iterator = iterator;
    this.range_from = range_from;
    this.range_to = range_to;
    this.range_by = range_by;
    this.sequence = sequence;
  }

};

this.Program.ForIn = class ForIn {
  constructor(token1, iterator, list, sequence) {
    this.token = token1;
    this.iterator = iterator;
    this.list = list;
    this.sequence = sequence;
  }

};

this.Program.toString = function(value, nesting = 0) {
  var i, j, k, key, len, pref, ref, s, v;
  if (value instanceof Routine) {
    if (nesting === 0) {
      return value.source || "[function]";
    } else {
      return "[function]";
    }
  } else if (typeof value === "function") {
    return "[native function]";
  } else if (typeof value === "string") {
    return `"${value}"`;
  } else if (Array.isArray(value)) {
    if (nesting >= 1) {
      return "[list]";
    }
    s = "[";
    for (i = j = 0, len = value.length; j < len; i = ++j) {
      v = value[i];
      s += Program.toString(v, nesting + 1) + (i < value.length - 1 ? "," : "");
    }
    return s + "]";
  } else if (typeof value === "object") {
    if (nesting >= 1) {
      return "[object]";
    }
    s = "object\n";
    pref = "";
    for (i = k = 1, ref = nesting; k <= ref; i = k += 1) {
      pref += "  ";
    }
    for (key in value) {
      v = value[key];
      s += pref + `  ${key} = ${Program.toString(v, nesting + 1)}\n`;
    }
    return s + pref + "end";
  }
  return value || 0;
};

this.Program.While = class While {
  constructor(token1, condition, sequence) {
    this.token = token1;
    this.condition = condition;
    this.sequence = sequence;
  }

};

this.Program.Break = class Break {
  constructor(token1) {
    this.token = token1;
    this.nopop = true;
  }

};

this.Program.Continue = class Continue {
  constructor(token1) {
    this.token = token1;
    this.nopop = true;
  }

};

this.Program.Function = class Function {
  constructor(token1, args, sequence, end) {
    this.token = token1;
    this.args = args;
    this.sequence = sequence;
    this.source = "function" + this.token.tokenizer.input.substring(this.token.index, end.index + 2);
  }

};

this.Program.FunctionCall = class FunctionCall {
  constructor(token1, expression1, args) {
    this.token = token1;
    this.expression = expression1;
    this.args = args;
  }

};

this.Program.CreateObject = class CreateObject {
  constructor(token1, fields) {
    this.token = token1;
    this.fields = fields;
  }

};

this.Program.CreateClass = class CreateClass {
  constructor(token1, ext, fields) {
    this.token = token1;
    this.ext = ext;
    this.fields = fields;
  }

};

this.Program.NewCall = class NewCall {
  constructor(token1, expression1) {
    this.token = token1;
    this.expression = expression1;
    if (!(this.expression instanceof Program.FunctionCall)) {
      this.expression = new Program.FunctionCall(this.token, this.expression, []);
    }
  }

};

this.Program.After = class After {
  constructor(token1, delay, sequence, end, multiplier) {
    this.token = token1;
    this.delay = delay;
    this.sequence = sequence;
    this.multiplier = multiplier;
    this.source = "after " + this.token.tokenizer.input.substring(this.token.index, end.index + 2);
  }

};

this.Program.Every = class Every {
  constructor(token1, delay, sequence, end, multiplier) {
    this.token = token1;
    this.delay = delay;
    this.sequence = sequence;
    this.multiplier = multiplier;
    this.source = "every " + this.token.tokenizer.input.substring(this.token.index, end.index + 2);
  }

};

this.Program.Do = class Do {
  constructor(token1, sequence, end) {
    this.token = token1;
    this.sequence = sequence;
    this.source = "do " + this.token.tokenizer.input.substring(this.token.index, end.index + 2);
  }

};

this.Program.Sleep = class Sleep {
  constructor(token1, delay, multiplier) {
    this.token = token1;
    this.delay = delay;
    this.multiplier = multiplier;
  }

};

this.Program.Delete = class Delete {
  constructor(token1, field1) {
    this.token = token1;
    this.field = field1;
  }

};

this.Program.Precedence = {
  "^": 21,
  "/": 20,
  "*": 19,
  "%": 18,
  "+": 17,
  "-": 17,
  "<": 16,
  "<=": 15,
  ">": 14,
  ">=": 13,
  "==": 12,
  "!=": 11,
  "<<": 10,
  ">>": 9,
  "&": 8,
  "|": 7,
  "and": 6,
  "or": 5
};

this.Routine = class Routine {
  constructor(num_args) {
    this.num_args = num_args;
    this.ops = [];
    this.opcodes = [];
    this.arg1 = [];
    this.ref = [];
    this.label_count = 0;
    this.labels = {};
    this.transpile = false;
    this.import_refs = [];
    this.import_values = [];
    this.import_self = -1;
  }

  clone() {
    var r;
    r = new Routine(this.num_args);
    r.opcodes = this.opcodes;
    r.arg1 = this.arg1;
    r.ref = this.ref;
    r.locals_size = this.locals_size;
    r.uses_arguments = this.uses_arguments;
    return r;
  }

  createLabel(str = "label") {
    var name;
    return name = ":" + str + "_" + this.label_count++;
  }

  setLabel(name) {
    return this.labels[name] = this.opcodes.length;
  }

  optimize() {
    if (this.transpile) {
      new Transpiler().transpile(this);
    }
  }

  removeable(index) {
    var label, ref1, value;
    ref1 = this.labels;
    for (label in ref1) {
      value = ref1[label];
      if (value === index) {
        return false;
      }
    }
    return true;
  }

  remove(index) {
    var label, ref1, value;
    ref1 = this.labels;
    for (label in ref1) {
      value = ref1[label];
      if (value === index) {
        return false;
      } else if (value > index) {
        this.labels[label] -= 1;
      }
    }
    this.opcodes.splice(index, 1);
    this.arg1.splice(index, 1);
    this.ref.splice(index, 1);
    return true;
  }

  resolveLabels() {
    var i, j, ref1, ref2, ref3, results;
    results = [];
    for (i = j = 0, ref1 = this.opcodes.length - 1; (0 <= ref1 ? j <= ref1 : j >= ref1); i = 0 <= ref1 ? ++j : --j) {
      if ((ref2 = this.opcodes[i]) === OPCODES.JUMP || ref2 === OPCODES.JUMPY || ref2 === OPCODES.JUMPN || ref2 === OPCODES.JUMPY_NOPOP || ref2 === OPCODES.JUMPN_NOPOP) {
        if (this.labels[this.arg1[i]]) {
          results.push(this.arg1[i] = this.labels[this.arg1[i]]);
        } else {
          results.push(void 0);
        }
      } else if ((ref3 = this.opcodes[i]) === OPCODES.FORLOOP_CONTROL || ref3 === OPCODES.FORLOOP_INIT || ref3 === OPCODES.FORIN_CONTROL || ref3 === OPCODES.FORIN_INIT) {
        if (this.labels[this.arg1[i][1]]) {
          results.push(this.arg1[i][1] = this.labels[this.arg1[i][1]]);
        } else {
          results.push(void 0);
        }
      } else {
        results.push(void 0);
      }
    }
    return results;
  }

  OP(code, ref, v1 = 0) {
    this.opcodes.push(code);
    this.arg1.push(v1);
    return this.ref.push(ref);
  }

  OP_INSERT(code, ref, v1 = 0, index) {
    var label, ref1, value;
    this.opcodes.splice(index, 0, code);
    this.arg1.splice(index, 0, v1);
    this.ref.splice(index, 0, ref);
    ref1 = this.labels;
    for (label in ref1) {
      value = ref1[label];
      if (value >= index) {
        this.labels[label] += 1;
      }
    }
  }

  TYPE(ref) {
    return this.OP(OPCODES.TYPE, ref);
  }

  VARIABLE_TYPE(variable, ref) {
    return this.OP(OPCODES.VARIABLE_TYPE, ref, variable);
  }

  PROPERTY_TYPE(ref) {
    return this.OP(OPCODES.PROPERTY_TYPE, ref);
  }

  LOAD_THIS(ref) {
    return this.OP(OPCODES.LOAD_THIS, ref);
  }

  LOAD_GLOBAL(ref) {
    return this.OP(OPCODES.LOAD_GLOBAL, ref);
  }

  LOAD_VALUE(value, ref) {
    return this.OP(OPCODES.LOAD_VALUE, ref, value);
  }

  LOAD_LOCAL(index, ref) {
    return this.OP(OPCODES.LOAD_LOCAL, ref, index);
  }

  LOAD_VARIABLE(variable, ref) {
    return this.OP(OPCODES.LOAD_VARIABLE, ref, variable);
  }

  LOAD_LOCAL_OBJECT(index, ref) {
    return this.OP(OPCODES.LOAD_LOCAL_OBJECT, ref, index);
  }

  LOAD_VARIABLE_OBJECT(variable, ref) {
    return this.OP(OPCODES.LOAD_VARIABLE_OBJECT, ref, variable);
  }

  POP(ref) {
    return this.OP(OPCODES.POP, ref);
  }

  LOAD_PROPERTY(ref) {
    return this.OP(OPCODES.LOAD_PROPERTY, ref);
  }

  LOAD_PROPERTY_OBJECT(ref) {
    return this.OP(OPCODES.LOAD_PROPERTY_OBJECT, ref);
  }

  CREATE_OBJECT(ref) {
    return this.OP(OPCODES.CREATE_OBJECT, ref);
  }

  MAKE_OBJECT(ref) {
    return this.OP(OPCODES.MAKE_OBJECT, ref);
  }

  CREATE_ARRAY(ref) {
    return this.OP(OPCODES.CREATE_ARRAY, ref);
  }

  CREATE_CLASS(parent_var, ref) {
    return this.OP(OPCODES.CREATE_CLASS, ref, parent_var);
  }

  UPDATE_CLASS(variable, ref) {
    return this.OP(OPCODES.UPDATE_CLASS, ref, variable);
  }

  NEW_CALL(args, ref) {
    return this.OP(OPCODES.NEW_CALL, ref, args);
  }

  ADD(ref, self = 0) {
    return this.OP(OPCODES.ADD, ref, self);
  }

  SUB(ref, self = 0) {
    return this.OP(OPCODES.SUB, ref, self);
  }

  MUL(ref) {
    return this.OP(OPCODES.MUL, ref);
  }

  DIV(ref) {
    return this.OP(OPCODES.DIV, ref);
  }

  MODULO(ref) {
    return this.OP(OPCODES.MODULO, ref);
  }

  BINARY_AND(ref) {
    return this.OP(OPCODES.BINARY_AND, ref);
  }

  BINARY_OR(ref) {
    return this.OP(OPCODES.BINARY_OR, ref);
  }

  SHIFT_LEFT(ref) {
    return this.OP(OPCODES.SHIFT_LEFT, ref);
  }

  SHIFT_RIGHT(ref) {
    return this.OP(OPCODES.SHIFT_RIGHT, ref);
  }

  NEGATE(ref) {
    return this.OP(OPCODES.NEGATE, ref);
  }

  LOAD_PROPERTY_ATOP(ref) {
    return this.OP(OPCODES.LOAD_PROPERTY_ATOP, ref);
  }

  EQ(ref) {
    return this.OP(OPCODES.EQ, ref);
  }

  NEQ(ref) {
    return this.OP(OPCODES.NEQ, ref);
  }

  LT(ref) {
    return this.OP(OPCODES.LT, ref);
  }

  GT(ref) {
    return this.OP(OPCODES.GT, ref);
  }

  LTE(ref) {
    return this.OP(OPCODES.LTE, ref);
  }

  GTE(ref) {
    return this.OP(OPCODES.GTE, ref);
  }

  NOT(ref) {
    return this.OP(OPCODES.NOT, ref);
  }

  FORLOOP_INIT(iterator, ref) {
    return this.OP(OPCODES.FORLOOP_INIT, ref, iterator);
  }

  FORLOOP_CONTROL(args, ref) {
    return this.OP(OPCODES.FORLOOP_CONTROL, ref, args);
  }

  FORIN_INIT(args, ref) {
    return this.OP(OPCODES.FORIN_INIT, ref, args);
  }

  FORIN_CONTROL(args, ref) {
    return this.OP(OPCODES.FORIN_CONTROL, ref, args);
  }

  JUMP(index, ref) {
    return this.OP(OPCODES.JUMP, ref, index);
  }

  JUMPY(index, ref) {
    return this.OP(OPCODES.JUMPY, ref, index);
  }

  JUMPN(index, ref) {
    return this.OP(OPCODES.JUMPN, ref, index);
  }

  JUMPY_NOPOP(index, ref) {
    return this.OP(OPCODES.JUMPY_NOPOP, ref, index);
  }

  JUMPN_NOPOP(index, ref) {
    return this.OP(OPCODES.JUMPN_NOPOP, ref, index);
  }

  STORE_LOCAL(index, ref) {
    return this.OP(OPCODES.STORE_LOCAL, ref, index);
  }

  STORE_VARIABLE(field, ref) {
    return this.OP(OPCODES.STORE_VARIABLE, ref, field);
  }

  CREATE_PROPERTY(ref) {
    return this.OP(OPCODES.CREATE_PROPERTY, ref);
  }

  STORE_PROPERTY(ref) {
    return this.OP(OPCODES.STORE_PROPERTY, ref);
  }

  LOAD_ROUTINE(value, ref) {
    return this.OP(OPCODES.LOAD_ROUTINE, ref, value);
  }

  FUNCTION_CALL(args, ref) {
    return this.OP(OPCODES.FUNCTION_CALL, ref, args);
  }

  FUNCTION_APPLY_VARIABLE(args, ref) {
    return this.OP(OPCODES.FUNCTION_APPLY_VARIABLE, ref, args);
  }

  FUNCTION_APPLY_PROPERTY(args, ref) {
    return this.OP(OPCODES.FUNCTION_APPLY_PROPERTY, ref, args);
  }

  SUPER_CALL(args, ref) {
    return this.OP(OPCODES.SUPER_CALL, ref, args);
  }

  RETURN(ref) {
    return this.OP(OPCODES.RETURN, ref);
  }

  AFTER(ref) {
    return this.OP(OPCODES.AFTER, ref);
  }

  EVERY(ref) {
    return this.OP(OPCODES.EVERY, ref);
  }

  DO(ref) {
    return this.OP(OPCODES.DO, ref);
  }

  SLEEP(ref) {
    return this.OP(OPCODES.SLEEP, ref);
  }

  DELETE(ref) {
    return this.OP(OPCODES.DELETE, ref);
  }

  UNARY_OP(f, ref) {
    return this.OP(OPCODES.UNARY_OP, ref, f);
  }

  BINARY_OP(f, ref) {
    return this.OP(OPCODES.BINARY_OP, ref, f);
  }

  toString() {
    var i, j, len, op, ref1, s;
    s = "";
    ref1 = this.opcodes;
    for (i = j = 0, len = ref1.length; j < len; i = ++j) {
      op = ref1[i];
      s += OPCODES[op];
      if (this.arg1[i] != null) {
        //if typeof @arg1[i] != "function"
        s += ` ${this.arg1[i]}`;
      }
      s += "\n";
    }
    return s;
  }

  exportArg(arg) {
    if (arg == null) {
      return 0;
    } else if (arg instanceof Routine) {
      return arg.export();
    } else if (typeof arg === "function") {
      return arg.name;
    } else {
      return arg;
    }
  }

  export() {
    var args, i, j, ref1, res;
    args = [];
    for (i = j = 0, ref1 = this.arg1.length - 1; j <= ref1; i = j += 1) {
      args[i] = this.exportArg(this.arg1[i]);
    }
    res = {
      num_args: this.num_args,
      ops: this.opcodes,
      args: args,
      import_refs: this.import_refs,
      import_values: this.import_values,
      import_self: this.import_self,
      locals_size: this.locals_size
    };
    return res;
  }

  import(src) {
    var i, j, ref, ref1, token;
    this.num_args = src.num_args;
    this.opcodes = src.ops;
    this.arg1 = src.args;
    this.import_refs = src.import_refs;
    this.import_values = src.import_values;
    this.import_self = src.import_self;
    this.locals_size = src.locals_size;
    token = {
      line: 0,
      column: 0,
      start: 0,
      length: 0,
      index: 0,
      tokenizer: {
        filename: "filename",
        input: ""
      }
    };
    ref = {
      expression: {
        token: token
      },
      token: token
    };
    for (i = j = 0, ref1 = this.opcodes.length - 1; j <= ref1; i = j += 1) {
      if (this.opcodes[i] === 100) {
        this.arg1[i] = Compiler.predefined_unary_functions[this.arg1[i]];
      } else if (this.opcodes[i] === 101) {
        this.arg1[i] = Compiler.predefined_binary_functions[this.arg1[i]];
      } else if (typeof this.arg1[i] === "object" && !Array.isArray(this.arg1[i])) {
        this.arg1[i] = new Routine(0).import(this.arg1[i]);
      }
      this.ref[i] = ref;
    }
    return this;
  }

};

this.OPCODES_CLASS = class OPCODES_CLASS {
  constructor() {
    this.table = {};
    this.set("TYPE", 1);
    this.set("VARIABLE_TYPE", 2);
    this.set("PROPERTY_TYPE", 3);
    this.set("LOAD_IMPORT", 4);
    this.set("LOAD_THIS", 5);
    this.set("LOAD_GLOBAL", 6);
    this.set("LOAD_VALUE", 10);
    this.set("LOAD_LOCAL", 11);
    this.set("LOAD_VARIABLE", 12);
    this.set("LOAD_LOCAL_OBJECT", 13);
    this.set("LOAD_VARIABLE_OBJECT", 14);
    this.set("POP", 15);
    this.set("LOAD_PROPERTY", 16);
    this.set("LOAD_PROPERTY_OBJECT", 17);
    this.set("CREATE_OBJECT", 18);
    this.set("MAKE_OBJECT", 19);
    this.set("CREATE_ARRAY", 20);
    this.set("STORE_LOCAL", 21);
    this.set("STORE_VARIABLE", 23);
    this.set("CREATE_PROPERTY", 24);
    this.set("STORE_PROPERTY", 25);
    this.set("DELETE", 26);
    this.set("UPDATE_CLASS", 27);
    this.set("CREATE_CLASS", 28);
    this.set("NEW_CALL", 29);
    this.set("ADD", 30);
    this.set("SUB", 31);
    this.set("MUL", 32);
    this.set("DIV", 33);
    this.set("MODULO", 34);
    this.set("BINARY_AND", 35);
    this.set("BINARY_OR", 36);
    this.set("SHIFT_LEFT", 37);
    this.set("SHIFT_RIGHT", 38);
    this.set("NEGATE", 39);
    this.set("EQ", 40);
    this.set("NEQ", 41);
    this.set("LT", 42);
    this.set("GT", 43);
    this.set("LTE", 44);
    this.set("GTE", 45);
    this.set("NOT", 50);
    this.set("LOAD_PROPERTY_ATOP", 68);
    this.set("JUMP", 80);
    this.set("JUMPY", 81);
    this.set("JUMPN", 82);
    this.set("JUMPY_NOPOP", 83);
    this.set("JUMPN_NOPOP", 84);
    this.set("LOAD_ROUTINE", 89);
    this.set("FUNCTION_CALL", 90);
    this.set("FUNCTION_APPLY_VARIABLE", 91);
    this.set("FUNCTION_APPLY_PROPERTY", 92);
    this.set("SUPER_CALL", 93);
    this.set("RETURN", 94);
    this.set("FORLOOP_INIT", 95);
    this.set("FORLOOP_CONTROL", 96);
    this.set("FORIN_INIT", 97);
    this.set("FORIN_CONTROL", 98);
    this.set("UNARY_OP", 100);
    this.set("BINARY_OP", 101);
    this.set("COMPILED", 200);
    this.set("AFTER", 110);
    this.set("EVERY", 111);
    this.set("DO", 112);
    this.set("SLEEP", 113);
  }

  set(op, code) {
    this[op] = code;
    return this[code] = op;
  }

};

this.OPCODES = new this.OPCODES_CLASS;

this.Processor = class Processor {
  constructor(runner) {
    this.runner = runner;
    this.locals = [];
    this.stack = [];
    this.call_stack = [];
    this.log = false;
    this.time_limit = 2e308;
    this.done = true;
  }

  load(routine1) {
    this.routine = routine1;
    return this.resetState();
  }

  resetState() {
    this.local_index = 0;
    this.stack_index = -1;
    this.op_index = 0;
    this.call_stack_index = 0;
    this.global = null;
    this.object = this.routine.object || null;
    this.locals_offset = 0;
    this.call_super = null;
    this.call_supername = "";
    return this.done = false;
  }

  resolveParentClass(obj, global) {
    if ((obj.class != null) && typeof obj.class === "string") {
      if (global[obj.class] != null) {
        obj.class = global[obj.class];
        return this.resolveParentClass(obj.class, global);
      }
    } else if (obj.class != null) {
      return this.resolveParentClass(obj.class, global);
    }
  }

  applyFunction(args) {}

  routineAsFunction(routine, context) {
    var f, proc;
    proc = new Processor(this.runner);
    f = function() {
      var a, count, i, j, k, ref, ref1;
      count = Math.min(routine.num_args, arguments.length);
      proc.load(routine);
      for (i = j = 0, ref = count - 1; j <= ref; i = j += 1) {
        proc.stack[++proc.stack_index] = arguments[i] || 0;
      }
      proc.stack[++proc.stack_index] = arguments.length;
      if (routine.uses_arguments) {
        a = [...arguments];
        for (i = k = 0, ref1 = a.length - 1; k <= ref1; i = k += 1) {
          if (a[i] == null) {
            a[i] = 0;
          }
        }
        proc.stack[++proc.stack_index] = a;
      }
      return proc.run(context);
    };
    //res = proc.stack[0]
    return f;
  }

  routineAsApplicableFunction(routine, context) {
    var f, proc;
    proc = new Processor(this.runner);
    f = function() {
      var a, count, i, j, k, ref, ref1, res;
      count = routine.num_args;
      proc.load(routine);
      proc.object = this;
      for (i = j = 0, ref = count - 1; j <= ref; i = j += 1) {
        proc.stack[++proc.stack_index] = arguments[i] || 0;
      }
      proc.stack[++proc.stack_index] = arguments.length;
      if (routine.uses_arguments) {
        a = [...arguments];
        for (i = k = 0, ref1 = a.length - 1; k <= ref1; i = k += 1) {
          if (a[i] == null) {
            a[i] = 0;
          }
        }
        proc.stack[++proc.stack_index] = a;
      }
      proc.run(context);
      return res = proc.stack[0];
    };
    return f;
  }

  argToNative(arg, context) {
    if (arg instanceof Routine) {
      return this.routineAsFunction(arg, context);
    } else {
      if (arg != null) {
        return arg;
      } else {
        return 0;
      }
    }
  }

  modulo(context, a, b) {
    var f, obj;
    if (Array.isArray(a)) {
      obj = context.global.List;
    } else if (typeof a === "string") {
      if (isFinite(a)) {
        a %= b;
        if (isFinite(a)) {
          return a;
        } else {
          return 0;
        }
      } else {
        obj = context.global.String;
      }
    } else {
      obj = a;
    }
    f = obj["%"];
    while ((f == null) && (obj.class != null)) {
      obj = obj.class;
      f = obj["%"];
    }
    if (f == null) {
      f = context.global.Object["%"];
    }
    if ((f != null) && f instanceof Routine) {
      if (f.as_function == null) {
        f.as_function = this.routineAsApplicableFunction(f, context);
      }
      f = f.as_function;
      return f.call(context.global, a, b);
    } else {
      return 0;
    }
  }

  add(context, a, b, self) {
    var f, obj;
    if (Array.isArray(a)) {
      obj = context.global.List;
    } else if (typeof a === "string") {
      obj = context.global.String;
    } else {
      obj = a;
    }
    f = obj["+"];
    while ((f == null) && (obj.class != null)) {
      obj = obj.class;
      f = obj["+"];
    }
    if (f == null) {
      f = context.global.Object["+"];
    }
    if (f != null) {
      if (f instanceof Routine) {
        if (f.as_function == null) {
          f.as_function = this.routineAsApplicableFunction(f, context);
        }
        f = f.as_function;
        return f.call(context.global, a, b, self);
      } else if (typeof f === "function") {
        return f.call(context.global, a, b, self);
      }
    } else {
      return 0;
    }
  }

  sub(context, a, b, self) {
    var f, obj;
    if (Array.isArray(a)) {
      obj = context.global.List;
    } else if (typeof a === "string") {
      if (isFinite(a)) {
        a -= b;
        if (isFinite(a)) {
          return a;
        } else {
          return 0;
        }
      } else {
        obj = context.global.String;
      }
    } else {
      obj = a;
    }
    f = obj["-"];
    while ((f == null) && (obj.class != null)) {
      obj = obj.class;
      f = obj["-"];
    }
    if (f == null) {
      f = context.global.Object["-"];
    }
    if (f != null) {
      if (f instanceof Routine) {
        if (f.as_function == null) {
          f.as_function = this.routineAsApplicableFunction(f, context);
        }
        f = f.as_function;
        return f.call(context.global, a, b, self);
      } else if (typeof f === "function") {
        return f.call(context.global, a, b, self);
      }
    } else {
      return 0;
    }
  }

  negate(context, a) {
    var f, obj;
    if (Array.isArray(a)) {
      obj = context.global.List;
    } else if (typeof a === "string") {
      if (isFinite(a)) {
        return -a;
      } else {
        obj = context.global.String;
      }
    } else {
      obj = a;
    }
    f = obj["-"];
    while ((f == null) && (obj.class != null)) {
      obj = obj.class;
      f = obj["-"];
    }
    if (f == null) {
      f = context.global.Object["-"];
    }
    if (f != null) {
      if (f instanceof Routine) {
        if (f.as_function == null) {
          f.as_function = this.routineAsApplicableFunction(f, context);
        }
        f = f.as_function;
        return f.call(context.global, 0, a);
      } else if (typeof f === "function") {
        return f.call(context.global, 0, a);
      }
    } else {
      return 0;
    }
  }

  mul(context, a, b, self) {
    var f, obj;
    if (Array.isArray(a)) {
      obj = context.global.List;
    } else if (typeof a === "string") {
      if (isFinite(a)) {
        a *= b;
        if (isFinite(a)) {
          return a;
        } else {
          return 0;
        }
      } else {
        obj = context.global.String;
      }
    } else {
      obj = a;
    }
    f = obj["*"];
    while ((f == null) && (obj.class != null)) {
      obj = obj.class;
      f = obj["*"];
    }
    if (f == null) {
      f = context.global.Object["*"];
    }
    if (f != null) {
      if (f instanceof Routine) {
        if (f.as_function == null) {
          f.as_function = this.routineAsApplicableFunction(f, context);
        }
        f = f.as_function;
        return f.call(context.global, a, b, self);
      } else if (typeof f === "function") {
        return f.call(context.global, a, b, self);
      }
    } else {
      return 0;
    }
  }

  div(context, a, b, self) {
    var f, obj;
    if (Array.isArray(a)) {
      obj = context.global.List;
    } else if (typeof a === "string") {
      if (isFinite(a)) {
        a /= b;
        if (isFinite(a)) {
          return a;
        } else {
          return 0;
        }
      } else {
        obj = context.global.String;
      }
    } else {
      obj = a;
    }
    f = obj["/"];
    while ((f == null) && (obj.class != null)) {
      obj = obj.class;
      f = obj["/"];
    }
    if (f == null) {
      f = context.global.Object["/"];
    }
    if (f != null) {
      if (f instanceof Routine) {
        if (f.as_function == null) {
          f.as_function = this.routineAsApplicableFunction(f, context);
        }
        f = f.as_function;
        return f.call(context.global, a, b, self);
      } else if (typeof f === "function") {
        return f.call(context.global, a, b, self);
      }
    } else {
      return 0;
    }
  }

  band(context, a, b, self) {
    var f, obj;
    if (Array.isArray(a)) {
      obj = context.global.List;
    } else if (typeof a === "string") {
      if (isFinite(a)) {
        a &= b;
        if (isFinite(a)) {
          return a;
        } else {
          return 0;
        }
      } else {
        obj = context.global.String;
      }
    } else {
      obj = a;
    }
    f = obj["&"];
    while ((f == null) && (obj.class != null)) {
      obj = obj.class;
      f = obj["&"];
    }
    if (f == null) {
      f = context.global.Object["&"];
    }
    if (f != null) {
      if (f instanceof Routine) {
        if (f.as_function == null) {
          f.as_function = this.routineAsApplicableFunction(f, context);
        }
        f = f.as_function;
        return f.call(context.global, a, b, self);
      } else if (typeof f === "function") {
        return f.call(context.global, a, b, self);
      }
    } else {
      return 0;
    }
  }

  bor(context, a, b, self) {
    var f, obj;
    if (Array.isArray(a)) {
      obj = context.global.List;
    } else if (typeof a === "string") {
      if (isFinite(a)) {
        a |= b;
        if (isFinite(a)) {
          return a;
        } else {
          return 0;
        }
      } else {
        obj = context.global.String;
      }
    } else {
      obj = a;
    }
    f = obj["|"];
    while ((f == null) && (obj.class != null)) {
      obj = obj.class;
      f = obj["|"];
    }
    if (f == null) {
      f = context.global.Object["|"];
    }
    if (f != null) {
      if (f instanceof Routine) {
        if (f.as_function == null) {
          f.as_function = this.routineAsApplicableFunction(f, context);
        }
        f = f.as_function;
        return f.call(context.global, a, b, self);
      } else if (typeof f === "function") {
        return f.call(context.global, a, b, self);
      }
    } else {
      return 0;
    }
  }

  run(context) {
    var a, arg1, args, argv, b, c, call_stack, call_stack_index, call_super, call_supername, con, cs, err, f, fc, field, global, i, i1, i2, id, index, ir, iter, iterator, j, k, key, l, len, length, local_index, locals, locals_offset, loop_by, loop_to, m, n, name, o, obj, object, op_count, op_index, opcodes, p, parent, q, r, rc, ref, ref1, ref10, ref11, ref12, ref13, ref14, ref2, ref3, ref4, ref5, ref6, ref7, ref8, ref9, res, restore_op_index, routine, s, sleep_time, src, stack, stack_index, sup, t, token, u, v, value, w;
    routine = this.routine;
    opcodes = this.routine.opcodes;
    arg1 = this.routine.arg1;
    length = opcodes.length;
    op_index = this.op_index;
    stack = this.stack;
    stack_index = this.stack_index;
    locals = this.locals;
    local_index = this.local_index;
    global = this.global || context.global;
    object = this.object || global;
    call_stack = this.call_stack;
    call_stack_index = this.call_stack_index;
    call_super = this.call_super || global;
    call_supername = this.call_supername || "";
    locals_offset = this.locals_offset;
    op_count = 0;
    restore_op_index = -1;
    while (op_index < length) {
      switch (opcodes[op_index]) {
        case 1: // OPCODE_TYPE
          v = stack[stack_index];
          switch (typeof v) {
            case "number":
              stack[stack_index] = "number";
              break;
            case "string":
              stack[stack_index] = "string";
              break;
            case "function":
              stack[stack_index] = "function";
              break;
            case "object":
              if (Array.isArray(v)) {
                stack[stack_index] = "list";
              } else if (v instanceof Routine) {
                stack[stack_index] = "function";
              } else {
                stack[stack_index] = "object";
              }
          }
          op_index++;
          break;
        case 2: // OPCODE_TYPE_VARIABLE
          v = object[arg1[op_index]];
          if (v == null) {
            v = global[arg1[op_index]];
          }
          if (v == null) {
            stack[++stack_index] = 0;
          } else {
            switch (typeof v) {
              case "number":
                stack[++stack_index] = "number";
                break;
              case "string":
                stack[++stack_index] = "string";
                break;
              case "function":
                stack[++stack_index] = "function";
                break;
              default:
                if (Array.isArray(v)) {
                  stack[++stack_index] = "list";
                } else if (v instanceof Routine) {
                  stack[++stack_index] = "function";
                } else {
                  stack[++stack_index] = "object";
                }
            }
          }
          op_index++;
          break;
        case 3: // OPCODE_TYPE_PROPERTY
          v = stack[stack_index - 1][stack[stack_index]];
          if (v == null) {
            stack[--stack_index] = 0;
          } else {
            switch (typeof v) {
              case "number":
                stack[--stack_index] = "number";
                break;
              case "string":
                stack[--stack_index] = "string";
                break;
              case "function":
                stack[--stack_index] = "function";
                break;
              default:
                if (Array.isArray(v)) {
                  stack[--stack_index] = "list";
                } else if (v instanceof Routine) {
                  stack[--stack_index] = "function";
                } else {
                  stack[--stack_index] = "object";
                }
            }
          }
          op_index++;
          break;
        case 4: // OPCODE_LOAD_IMPORT
          stack[++stack_index] = routine.import_values[arg1[op_index++]];
          break;
        case 5: // OPCODE_LOAD_THIS
          stack[++stack_index] = object;
          op_index++;
          break;
        case 6: // OPCODE_LOAD_GLOBAL
          stack[++stack_index] = global;
          op_index++;
          break;
        case 10: // CODE_LOAD_VALUE
          stack[++stack_index] = arg1[op_index++];
          break;
        case 11: // OPCODE_LOAD_LOCAL
          stack[++stack_index] = locals[locals_offset + arg1[op_index++]];
          break;
        case 12: // OPCODE_LOAD_VARIABLE
          name = arg1[op_index];
          v = object[name];
          if ((v == null) && (object.class != null)) {
            obj = object;
            while ((v == null) && (obj.class != null)) {
              obj = obj.class;
              v = obj[name];
            }
          }
          if (v == null) {
            v = global[name];
          }
          if ((v == null) && !routine.ref[op_index].nowarning) {
            token = routine.ref[op_index].token;
            id = token.tokenizer.filename + "-" + token.line + "-" + token.column;
            if (!context.warnings.using_undefined_variable[id]) {
              context.warnings.using_undefined_variable[id] = {
                file: token.tokenizer.filename,
                line: token.line,
                column: token.column,
                expression: name
              };
            }
          }
          stack[++stack_index] = v != null ? v : 0;
          op_index++;
          break;
        case 13: // OPCODE_LOAD_LOCAL_OBJECT
          o = locals[locals_offset + arg1[op_index]];
          if (typeof o !== "object") {
            o = locals[locals_offset + arg1[op_index]] = {};
            token = routine.ref[op_index].token;
            id = token.tokenizer.filename + "-" + token.line + "-" + token.column;
            if (!context.warnings.assigning_field_to_undefined[id]) {
              context.warnings.assigning_field_to_undefined[id] = {
                file: token.tokenizer.filename,
                line: token.line,
                column: token.column,
                expression: token.value
              };
            }
          }
          stack[++stack_index] = o;
          op_index++;
          break;
        case 14: // OPCODE_LOAD_VARIABLE_OBJECT
          name = arg1[op_index];
          obj = object;
          v = obj[name];
          while ((v == null) && (obj.class != null)) {
            obj = obj.class;
            v = obj[name];
          }
          if ((v == null) && (global[name] != null)) {
            obj = global;
            v = global[name];
          }
          if ((v == null) || typeof v !== "object") {
            v = obj[name] = {};
            token = routine.ref[op_index].token;
            id = token.tokenizer.filename + "-" + token.line + "-" + token.column;
            if (!context.warnings.assigning_field_to_undefined[id]) {
              context.warnings.assigning_field_to_undefined[id] = {
                file: token.tokenizer.filename,
                line: token.line,
                column: token.column,
                expression: arg1[op_index]
              };
            }
          }
          stack[++stack_index] = v;
          op_index++;
          break;
        case 15: // OPCODE_POP
          stack_index--;
          op_index++;
          break;
        case 16: // OPCODE_LOAD_PROPERTY
          obj = stack[stack_index - 1];
          name = stack[stack_index];
          v = obj[name];
          while ((v == null) && (obj.class != null)) {
            obj = obj.class;
            v = obj[name];
          }
          if (v == null) {
            v = 0;
            if (!routine.ref[op_index].nowarning) {
              routine.ref[op_index].nowarning = true;
              if (!Array.isArray(obj)) {
                token = routine.ref[op_index].token;
                id = token.tokenizer.filename + "-" + token.line + "-" + token.column;
                context.warnings.using_undefined_variable[id] = {
                  file: token.tokenizer.filename,
                  line: token.line,
                  column: token.column,
                  expression: name
                };
              }
            }
          }
          stack[--stack_index] = v;
          op_index++;
          break;
        case 17: // OPCODE_LOAD_PROPERTY_OBJECT
          v = stack[stack_index - 1][stack[stack_index]];
          if (typeof v !== "object") {
            v = stack[stack_index - 1][stack[stack_index]] = {};
            token = routine.ref[op_index].token;
            id = token.tokenizer.filename + "-" + token.line + "-" + token.column;
            if (!context.warnings.assigning_field_to_undefined[id]) {
              context.warnings.assigning_field_to_undefined[id] = {
                file: token.tokenizer.filename,
                line: token.line,
                column: token.column,
                expression: stack[stack_index]
              };
            }
          }
          stack[--stack_index] = v;
          op_index++;
          break;
        case 18: // OPCODE_CREATE_OBJECT
          stack[++stack_index] = {};
          op_index++;
          break;
        case 19: // OPCODE_MAKE_OBJECT
          if (typeof stack[stack_index] !== "object") {
            stack[stack_index] = {};
          }
          op_index++;
          break;
        case 20: // OPCODE_CREATE_ARRAY
          stack[++stack_index] = [];
          op_index++;
          break;
        case 21: // OPCODE_STORE_LOCAL
          locals[locals_offset + arg1[op_index]] = stack[stack_index];
          op_index++;
          break;
        case 22: // OPCODE_STORE_LOCAL_POP
          locals[locals_offset + arg1[op_index]] = stack[stack_index--];
          op_index++;
          break;
        case 23: // OPCODE_STORE_VARIABLE
          object[arg1[op_index++]] = stack[stack_index];
          break;
        case 24: // OPCODE_CREATE_PROPERTY
          obj = stack[stack_index - 2];
          field = stack[stack_index - 1];
          obj[field] = stack[stack_index];
          stack_index -= 2;
          op_index++;
          break;
        case 25: // OPCODE_STORE_PROPERTY
          obj = stack[stack_index - 2];
          field = stack[stack_index - 1];
          stack[stack_index - 2] = obj[field] = stack[stack_index];
          stack_index -= 2;
          op_index++;
          break;
        case 26: // OPCODE_DELETE
          obj = stack[stack_index - 1];
          field = stack[stack_index];
          delete obj[field];
          stack[stack_index -= 1] = 0;
          op_index++;
          break;
        case 27: // OPCODE_UPDATE_CLASS
          name = arg1[op_index];
          // TODO: set classname to variable name
          if ((object[name] != null) && typeof object[name] === "object") {
            obj = object[name];
            src = stack[stack_index];
            for (key in src) {
              value = src[key];
              obj[key] = value;
            }
          } else {
            object[name] = stack[stack_index];
          }
          op_index++;
          break;
        case 28: // OPCODE_CREATE_CLASS
          res = {};
          parent = stack[stack_index];
          if (parent) {
            res.class = parent;
          } else if (arg1[op_index]) {
            res.class = arg1[op_index];
          }
          stack[stack_index] = res;
          op_index++;
          break;
        case 29: // OPCODE_NEW_CALL
          c = stack[stack_index];
          args = arg1[op_index];
          if (typeof c === "function") {
            a = [];
            for (i = j = 0, ref = args - 1; j <= ref; i = j += 1) {
              a.push(stack[stack_index - args + i]);
            }
            stack_index -= args;
            // NEW CALL is followed by a POP (to get rid of constructor return value)
            stack[stack_index - 1] = new c(...a);
            op_index++;
          } else {
            this.resolveParentClass(c, global);
            res = {
              class: c
            };
            con = c.constructor;
            while (!con && (c.class != null)) {
              c = c.class;
              con = c.constructor;
            }
            if ((con != null) && con instanceof Routine) {
              stack[stack_index - args - 1] = res;
              stack_index--;
              cs = call_stack[call_stack_index] || (call_stack[call_stack_index] = {});
              call_stack_index++;
              cs.routine = routine;
              cs.object = object;
              cs.super = call_super;
              cs.supername = call_supername;
              cs.op_index = op_index + 1;
              locals_offset += routine.locals_size;
              routine = con;
              opcodes = con.opcodes;
              arg1 = con.arg1;
              op_index = 0;
              length = opcodes.length;
              object = res;
              call_super = c;
              call_supername = "constructor";
              if (routine.uses_arguments) {
                argv = stack.slice(stack_index - args + 1, stack_index + 1);
              }
              if (args < con.num_args) {
                for (i = k = ref1 = args + 1, ref2 = con.num_args; k <= ref2; i = k += 1) {
                  stack[++stack_index] = 0;
                }
              } else if (args > con.num_args) {
                stack_index -= args - con.num_args;
              }
              stack[++stack_index] = args;
              if (routine.uses_arguments) {
                stack[++stack_index] = argv;
              }
            } else {
              stack_index -= args;
              stack[stack_index - 1] = res;
              op_index++;
            }
          }
          break;
        case 30: // OPCODE_ADD
          b = stack[stack_index--];
          a = stack[stack_index];
          if (typeof a === "number") {
            a += b;
            stack[stack_index] = isFinite(a) || typeof b === "string" ? a : 0;
          } else {
            stack[stack_index] = this.add(context, a, b, arg1[op_index]);
          }
          op_index++;
          break;
        case 31: // OPCODE_SUB
          b = stack[stack_index--];
          a = stack[stack_index];
          if (typeof a === "number") {
            a -= b;
            stack[stack_index] = isFinite(a) ? a : 0;
          } else {
            stack[stack_index] = this.sub(context, a, b, arg1[op_index]);
          }
          op_index++;
          break;
        case 32: // OPCODE_MUL
          b = stack[stack_index--];
          a = stack[stack_index];
          if (typeof a === "number") {
            a *= b;
            stack[stack_index] = isFinite(a) ? a : 0;
          } else {
            stack[stack_index] = this.mul(context, a, b);
          }
          op_index++;
          break;
        case 33: // OPCODE_DIV
          b = stack[stack_index--];
          a = stack[stack_index];
          if (typeof a === "number") {
            a /= b;
            stack[stack_index] = isFinite(a) ? a : 0;
          } else {
            stack[stack_index] = this.div(context, a, b);
          }
          op_index++;
          break;
        case 34: // OPCODE_MODULO
          b = stack[stack_index--];
          a = stack[stack_index];
          if (typeof a === "number" && typeof b === "number") {
            a %= b;
            stack[stack_index] = isFinite(a) ? a : 0;
          } else {
            stack[stack_index] = this.modulo(context, a, b);
          }
          op_index++;
          break;
        case 35: // OPCODE_BINARY_AND
          b = stack[stack_index--];
          a = stack[stack_index];
          if (typeof a === "number") {
            a &= b;
            stack[stack_index] = isFinite(a) ? a : 0;
          } else {
            stack[stack_index] = this.band(context, a, b);
          }
          op_index++;
          break;
        case 36: // OPCODE_BINARY_OR
          b = stack[stack_index--];
          a = stack[stack_index];
          if (typeof a === "number") {
            a |= b;
            stack[stack_index] = isFinite(a) ? a : 0;
          } else {
            stack[stack_index] = this.bor(context, a, b);
          }
          op_index++;
          break;
        case 37: // OPCODE_SHIFT_LEFT
          v = stack[stack_index - 1] << stack[stack_index];
          stack[--stack_index] = isFinite(v) ? v : 0;
          op_index++;
          break;
        case 38: // OPCODE_SHIFT_RIGHT
          v = stack[stack_index - 1] >> stack[stack_index];
          stack[--stack_index] = isFinite(v) ? v : 0;
          op_index++;
          break;
        case 39: // OPCODE_NEGATE
          a = stack[stack_index];
          if (typeof a === "number") {
            stack[stack_index] = -a;
          } else {
            stack[stack_index] = this.negate(context, a);
          }
          op_index++;
          break;
        case 50: // OPCODE_NOT
          stack[stack_index] = stack[stack_index] ? 0 : 1;
          op_index++;
          break;
        case 68: // OPCODE_LOAD_PROPERTY_ATOP
          obj = stack[stack_index - 1];
          name = stack[stack_index];
          v = obj[name];
          while ((v == null) && (obj.class != null)) {
            obj = obj.class;
            v = obj[name];
          }
          if (v == null) {
            v = 0;
            if (!routine.ref[op_index].nowarning) {
              routine.ref[op_index].nowarning = true;
              if (!Array.isArray(obj)) {
                token = routine.ref[op_index].token;
                id = token.tokenizer.filename + "-" + token.line + "-" + token.column;
                context.warnings.using_undefined_variable[id] = {
                  file: token.tokenizer.filename,
                  line: token.line,
                  column: token.column,
                  expression: name
                };
              }
            }
          }
          stack[++stack_index] = v;
          op_index++;
          break;
        case 40: // OPCODE_EQ
          stack[stack_index - 1] = stack[stack_index] === stack[stack_index - 1] ? 1 : 0;
          stack_index--;
          op_index++;
          break;
        case 41: // OPCODE_NEQ
          stack[stack_index - 1] = stack[stack_index] !== stack[stack_index - 1] ? 1 : 0;
          stack_index--;
          op_index++;
          break;
        case 42: // OPCODE_LT
          stack[stack_index - 1] = stack[stack_index - 1] < stack[stack_index] ? 1 : 0;
          stack_index--;
          op_index++;
          break;
        case 43: // OPCODE_GT
          stack[stack_index - 1] = stack[stack_index - 1] > stack[stack_index] ? 1 : 0;
          stack_index--;
          op_index++;
          break;
        case 44: // OPCODE_LTE
          stack[stack_index - 1] = stack[stack_index - 1] <= stack[stack_index] ? 1 : 0;
          stack_index--;
          op_index++;
          break;
        case 45: // OPCODE_GTE
          stack[stack_index - 1] = stack[stack_index - 1] >= stack[stack_index] ? 1 : 0;
          stack_index--;
          op_index++;
          break;
        case 95: // FORLOOP_INIT
          // fix loop_by if not set
          iter = arg1[op_index][0];
          loop_to = locals[locals_offset + iter + 1] = stack[stack_index - 1];
          loop_by = stack[stack_index];
          iterator = locals[locals_offset + iter];
          stack[--stack_index] = 0; // unload 2 values and load default value
          if (loop_by === 0) {
            locals[locals_offset + iter + 2] = loop_to > iterator ? 1 : -1;
            op_index++;
          } else {
            locals[locals_offset + iter + 2] = loop_by;
            if ((loop_by > 0 && iterator > loop_to) || (loop_by < 0 && iterator < loop_to)) {
              op_index = arg1[op_index][1];
            } else {
              op_index++;
            }
          }
          break;
        case 96: // FORLOOP_CONTROL
          iter = arg1[op_index][0];
          loop_by = locals[locals_offset + iter + 2];
          loop_to = locals[locals_offset + iter + 1];
          iterator = locals[locals_offset + iter];
          iterator += loop_by;
          if ((loop_by > 0 && iterator > loop_to) || (loop_by < 0 && iterator < loop_to)) {
            op_index++;
          } else {
            locals[locals_offset + iter] = iterator;
            op_index = arg1[op_index][1];
          }
          if (op_count++ > 100) {
            op_count = 0;
            if (Date.now() > this.time_limit) {
              restore_op_index = op_index;
              op_index = length; // stop the loop without adding a condition statement
            }
          }
          break;
        case 97: // FORIN_INIT
          v = stack[stack_index];
          stack[stack_index] = 0; // default result
          iterator = arg1[op_index][0];
          if (typeof v === "object") {
            if (Array.isArray(v)) {
              locals[locals_offset + iterator + 1] = v;
            } else {
              v = locals[locals_offset + iterator + 1] = Object.keys(v);
            }
          } else if (typeof v === "string") {
            v = locals[locals_offset + iterator + 1] = v.split("");
          } else {
            v = locals[locals_offset + iterator + 1] = [];
          }
          if (v.length === 0) {
            op_index = arg1[op_index][1];
          } else {
            value = v[0];
            // value could be undefined if the array is sparse
            locals[locals_offset + arg1[op_index][0]] = value != null ? value : 0;
            locals[locals_offset + iterator + 2] = 0;
            op_index++;
          }
          break;
        case 98: // FORIN_CONTROL
          iterator = arg1[op_index][0];
          index = locals[locals_offset + iterator + 2] += 1;
          v = locals[locals_offset + iterator + 1];
          if (index < v.length) {
            value = v[index];
            // value could be undefined if the array is sparse
            locals[locals_offset + iterator] = value != null ? value : 0;
            op_index = arg1[op_index][1];
          } else {
            op_index++;
          }
          if (op_count++ > 100) {
            op_count = 0;
            if (Date.now() > this.time_limit) {
              restore_op_index = op_index;
              op_index = length; // stop the loop without adding a condition statement
            }
          }
          break;
        case 80: // OPCODE_JUMP
          op_index = arg1[op_index];
          if (op_count++ > 100) {
            op_count = 0;
            if (Date.now() > this.time_limit) {
              restore_op_index = op_index;
              op_index = length; // stop the loop without adding a condition statement
            }
          }
          break;
        case 81: // OPCODE_JUMPY
          if (stack[stack_index--]) {
            op_index = arg1[op_index];
          } else {
            op_index++;
          }
          break;
        case 82: // OPCODE_JUMPN
          if (!stack[stack_index--]) {
            op_index = arg1[op_index];
          } else {
            op_index++;
          }
          break;
        case 83: // OPCODE_JUMPY_NOPOP
          if (stack[stack_index]) {
            op_index = arg1[op_index];
          } else {
            op_index++;
          }
          break;
        case 84: // OPCODE_JUMPN_NOPOP
          if (!stack[stack_index]) {
            op_index = arg1[op_index];
          } else {
            op_index++;
          }
          break;
        case 89: // OPCODE_LOAD_ROUTINE
          r = arg1[op_index++];
          rc = r.clone();
          ref3 = r.import_refs;
          for (l = 0, len = ref3.length; l < len; l++) {
            ir = ref3[l];
            if (ir === r.import_self) {
              rc.import_values.push(rc);
            } else {
              rc.import_values.push(locals[locals_offset + ir]);
            }
          }
          rc.object = object;
          stack[++stack_index] = rc;
          break;
        case 90: // OPCODE_FUNCTION_CALL
          args = arg1[op_index];
          f = stack[stack_index];
          if (f instanceof Routine) {
            stack_index--;
            cs = call_stack[call_stack_index] || (call_stack[call_stack_index] = {});
            call_stack_index++;
            cs.routine = routine;
            cs.object = object;
            cs.super = call_super;
            cs.supername = call_supername;
            cs.op_index = op_index + 1;
            locals_offset += routine.locals_size;
            routine = f;
            opcodes = f.opcodes;
            arg1 = f.arg1;
            op_index = 0;
            length = opcodes.length;
            object = routine.object != null ? routine.object : global;
            call_super = global;
            call_supername = "";
            if (routine.uses_arguments) {
              argv = stack.slice(stack_index - args + 1, stack_index + 1);
            }
            if (args < f.num_args) {
              for (i = m = ref4 = args + 1, ref5 = f.num_args; m <= ref5; i = m += 1) {
                stack[++stack_index] = 0;
              }
            } else if (args > f.num_args) {
              stack_index -= args - f.num_args;
            }
            stack[++stack_index] = args;
            if (routine.uses_arguments) {
              stack[++stack_index] = argv;
            }
          } else if (typeof f === "function") {
            switch (args) {
              case 0:
                try {
                  v = f();
                } catch (error) {
                  err = error;
                  console.error(err);
                  v = 0;
                }
                stack[stack_index] = v != null ? v : 0;
                break;
              case 1:
                try {
                  v = f(this.argToNative(stack[stack_index - 1], context));
                } catch (error) {
                  err = error;
                  console.error(err);
                  v = 0;
                }
                stack[stack_index - 1] = v != null ? v : 0;
                stack_index -= 1;
                break;
              default:
                argv = [];
                stack_index -= args;
                for (i = n = 0, ref6 = args - 1; n <= ref6; i = n += 1) {
                  argv[i] = this.argToNative(stack[stack_index + i], context);
                }
                try {
                  v = f.apply(null, argv);
                } catch (error) {
                  err = error;
                  console.error(err);
                  v = 0;
                }
                stack[stack_index] = v != null ? v : 0;
            }
            op_index++;
          } else {
            stack_index -= args;
            stack[stack_index] = f != null ? f : 0;
            token = routine.ref[op_index].token;
            id = token.tokenizer.filename + "-" + token.line + "-" + token.column;
            if (!context.warnings.invoking_non_function[id]) {
              fc = routine.ref[op_index];
              i1 = fc.expression.token.start;
              i2 = fc.token.start + fc.token.length;
              context.warnings.invoking_non_function[id] = {
                file: token.tokenizer.filename,
                line: token.line,
                column: token.column,
                expression: fc.token.tokenizer.input.substring(i1, i2)
              };
            }
            op_index++;
          }
          break;
        case 91: // OPCODE_FUNCTION_APPLY_VARIABLE
          name = stack[stack_index];
          sup = obj = object;
          f = obj[name];
          if (f == null) {
            while ((f == null) && (sup.class != null)) {
              sup = sup.class;
              f = sup[name];
            }
            if (f == null) {
              f = global.Object[name];
            }
            if (f == null) {
              f = global[name];
              sup = global;
              obj = global;
            }
          }
          args = arg1[op_index];
          if (f instanceof Routine) {
            stack_index -= 1;
            cs = call_stack[call_stack_index] || (call_stack[call_stack_index] = {});
            call_stack_index++;
            cs.routine = routine;
            cs.object = object;
            cs.super = call_super;
            cs.supername = call_supername;
            cs.op_index = op_index + 1;
            locals_offset += routine.locals_size;
            routine = f;
            opcodes = f.opcodes;
            arg1 = f.arg1;
            op_index = 0;
            length = opcodes.length;
            object = obj;
            call_super = sup;
            call_supername = name;
            if (routine.uses_arguments) {
              argv = stack.slice(stack_index - args + 1, stack_index + 1);
            }
            if (args < f.num_args) {
              for (i = p = ref7 = args + 1, ref8 = f.num_args; p <= ref8; i = p += 1) {
                stack[++stack_index] = 0;
              }
            } else if (args > f.num_args) {
              stack_index -= args - f.num_args;
            }
            stack[++stack_index] = args;
            if (routine.uses_arguments) {
              stack[++stack_index] = argv;
            }
          } else if (typeof f === "function") {
            switch (args) {
              case 0:
                try {
                  v = f.call(obj);
                } catch (error) {
                  err = error;
                  console.error(err);
                  v = 0;
                }
                stack[stack_index] = v != null ? v : 0;
                break;
              case 1:
                try {
                  v = f.call(obj, this.argToNative(stack[stack_index - 1], context));
                } catch (error) {
                  err = error;
                  console.error(err);
                  v = 0;
                }
                stack[--stack_index] = v != null ? v : 0;
                break;
              default:
                argv = [];
                stack_index -= args;
                for (i = q = 0, ref9 = args - 1; q <= ref9; i = q += 1) {
                  argv[i] = this.argToNative(stack[stack_index + i], context);
                }
                try {
                  v = f.apply(obj, argv);
                } catch (error) {
                  err = error;
                  console.error(err);
                  v = 0;
                }
                stack[stack_index] = v != null ? v : 0;
            }
            op_index++;
          } else {
            stack_index -= args;
            stack[stack_index] = f != null ? f : 0;
            token = routine.ref[op_index].token;
            id = token.tokenizer.filename + "-" + token.line + "-" + token.column;
            if (!context.warnings.invoking_non_function[id]) {
              fc = routine.ref[op_index];
              i1 = fc.expression.token.start;
              i2 = fc.token.start + fc.token.length;
              context.warnings.invoking_non_function[id] = {
                file: token.tokenizer.filename,
                line: token.line,
                column: token.column,
                expression: fc.token.tokenizer.input.substring(i1, i2)
              };
            }
            op_index++;
          }
          break;
        case 92: // OPCODE_FUNCTION_APPLY_PROPERTY
          obj = stack[stack_index - 1];
          sup = obj;
          name = stack[stack_index];
          f = obj[name];
          while ((f == null) && (sup.class != null)) {
            sup = sup.class;
            f = sup[name];
          }
          args = arg1[op_index];
          if (f == null) {
            if (obj instanceof Routine) {
              f = global.Function[name];
            } else if (typeof obj === "string") {
              f = global.String[name];
            } else if (typeof obj === "number") {
              f = global.Number[name];
            } else if (Array.isArray(obj)) {
              f = global.List[name];
            } else if (typeof obj === "object") {
              f = global.Object[name];
            }
          }
          if (f instanceof Routine) {
            stack_index -= 2;
            cs = call_stack[call_stack_index] || (call_stack[call_stack_index] = {});
            call_stack_index++;
            cs.object = object;
            cs.super = call_super;
            cs.supername = call_supername;
            cs.routine = routine;
            cs.op_index = op_index + 1;
            locals_offset += routine.locals_size;
            routine = f;
            opcodes = f.opcodes;
            arg1 = f.arg1;
            op_index = 0;
            length = opcodes.length;
            object = obj;
            call_super = sup;
            call_supername = name;
            if (routine.uses_arguments) {
              argv = stack.slice(stack_index - args + 1, stack_index + 1);
            }
            if (args < f.num_args) {
              for (i = s = ref10 = args + 1, ref11 = f.num_args; s <= ref11; i = s += 1) {
                stack[++stack_index] = 0;
              }
            } else if (args > f.num_args) {
              stack_index -= args - f.num_args;
            }
            stack[++stack_index] = args;
            if (routine.uses_arguments) {
              stack[++stack_index] = argv;
            }
          } else if (typeof f === "function") {
            switch (args) {
              case 0:
                try {
                  v = f.call(obj);
                } catch (error) {
                  err = error;
                  console.error(err);
                  v = 0;
                }
                stack[--stack_index] = v != null ? v : 0;
                break;
              case 1:
                try {
                  v = f.call(obj, this.argToNative(stack[stack_index - 2], context));
                } catch (error) {
                  err = error;
                  console.error(err);
                  v = 0;
                }
                stack[stack_index - 2] = v != null ? v : 0;
                stack_index -= 2;
                break;
              default:
                argv = [];
                stack_index -= args + 1;
                for (i = u = 0, ref12 = args - 1; u <= ref12; i = u += 1) {
                  argv[i] = this.argToNative(stack[stack_index + i], context);
                }
                try {
                  v = f.apply(obj, argv);
                } catch (error) {
                  err = error;
                  console.error(err);
                  v = 0;
                }
                stack[stack_index] = v != null ? v : 0;
            }
            op_index++;
          } else {
            stack_index -= args + 1;
            stack[stack_index] = f != null ? f : 0;
            token = routine.ref[op_index].token;
            id = token.tokenizer.filename + "-" + token.line + "-" + token.column;
            if (!context.warnings.invoking_non_function[id]) {
              fc = routine.ref[op_index];
              i1 = fc.expression.token.start;
              i2 = fc.token.start + fc.token.length;
              context.warnings.invoking_non_function[id] = {
                file: token.tokenizer.filename,
                line: token.line,
                column: token.column,
                expression: fc.token.tokenizer.input.substring(i1, i2)
              };
            }
            op_index++;
          }
          break;
        case 93: // OPCODE_SUPER_CALL
          if ((call_super != null) && (call_supername != null)) {
            sup = call_super;
            f = null;
            while ((f == null) && (sup.class != null)) {
              sup = sup.class;
              f = sup[call_supername];
            }
            if ((f != null) && f instanceof Routine) {
              args = arg1[op_index];
              cs = call_stack[call_stack_index] || (call_stack[call_stack_index] = {});
              call_stack_index++;
              cs.object = object;
              cs.super = call_super;
              cs.supername = call_supername;
              cs.routine = routine;
              cs.op_index = op_index + 1;
              locals_offset += routine.locals_size;
              routine = f;
              opcodes = f.opcodes;
              arg1 = f.arg1;
              op_index = 0;
              length = opcodes.length;
              call_super = sup;
              if (routine.uses_arguments) {
                argv = stack.slice(stack_index - args + 1, stack_index + 1);
              }
              if (args < f.num_args) {
                for (i = w = ref13 = args + 1, ref14 = f.num_args; w <= ref14; i = w += 1) {
                  stack[++stack_index] = 0;
                }
              } else if (args > f.num_args) {
                stack_index -= args - f.num_args;
              }
              stack[++stack_index] = args;
              if (routine.uses_arguments) {
                stack[++stack_index] = argv;
              }
            } else {
              args = arg1[op_index];
              stack_index -= args;
              stack[++stack_index] = 0;
              op_index++;
            }
          } else {
            args = arg1[op_index];
            stack_index -= args;
            stack[++stack_index] = 0;
            op_index++;
          }
          break;
        case 94: // OPCODE_RETURN
          local_index -= arg1[op_index];
          if (call_stack_index <= 0) {
            op_index = length;
          } else {
            cs = call_stack[--call_stack_index];
            object = cs.object;
            call_super = cs.super;
            call_supername = cs.supername;
            routine = cs.routine;
            op_index = cs.op_index;
            opcodes = routine.opcodes;
            arg1 = routine.arg1;
            locals_offset -= routine.locals_size;
            length = opcodes.length;
          }
          break;
        case 100: // OPCODE_UNARY_FUNC
          v = arg1[op_index](stack[stack_index]);
          stack[stack_index] = isFinite(v) ? v : 0;
          op_index++;
          break;
        case 101: // OPCODE_BINARY_FUNC
          v = arg1[op_index](stack[stack_index - 1], stack[stack_index]);
          stack[--stack_index] = isFinite(v) ? v : 0;
          op_index++;
          break;
        case 110: // OPCODE_AFTER
          t = this.runner.createThread(stack[stack_index - 1], stack[stack_index], false);
          stack[--stack_index] = t;
          op_index += 1;
          break;
        // add thread to the runner thread list
        case 111: // OPCODE_EVERY
          t = this.runner.createThread(stack[stack_index - 1], stack[stack_index], true);
          stack[--stack_index] = t;
          op_index += 1;
          break;
        // add thread to the runner thread list
        case 112: // OPCODE_DO
          t = this.runner.createThread(stack[stack_index], 0, false);
          stack[stack_index] = t;
          op_index += 1;
          break;
        // add thread to the runner thread list
        case 113: // OPCODE_SLEEP
          sleep_time = isFinite(stack[stack_index]) ? stack[stack_index] : 0;
          this.runner.sleep(sleep_time);
          op_index += 1;
          restore_op_index = op_index;
          op_index = length; // stop the thread
          break;
        case 200: // COMPILED
          stack_index = arg1[op_index](stack, stack_index, locals, locals_offset, object, global);
          op_index++;
          break;
        default:
          throw `Unsupported operation: ${opcodes[op_index]}`;
      }
    }
    if (restore_op_index >= 0) {
      this.op_index = restore_op_index;
      this.routine = routine;
      this.stack_index = stack_index;
      this.local_index = local_index;
      this.object = object;
      this.call_stack_index = call_stack_index;
      this.call_super = call_super;
      this.call_supername = call_supername;
      this.locals_offset = locals_offset;
      this.done = false;
    } else {
      this.op_index = 0;
      this.done = true;
      if (this.routine.callback != null) {
        this.routine.callback(stack[stack_index]);
        this.routine.callback = null;
      }
    }
    // console.info """stack_index: #{stack_index}"""
    // console.info stack
    if (this.log) {
      console.info("total operations: " + op_count);
      console.info(`stack_index: ${stack_index}`);
      console.info(`result: ${stack[stack_index]}`);
    }
    return stack[stack_index];
  }

};

var Compiler, LocalLayer;

Compiler = (function() {
  class Compiler {
    constructor(program) {
      var i, j, len, ref, s;
      this.program = program;
      this.code_saves = [];
      this.code = "";
      this.code = [this.code];
      this.routine = new Routine();
      this.locals = new Locals(this);
      this.count = 0;
      ref = this.program.statements;
      for (i = j = 0, len = ref.length; j < len; i = ++j) {
        s = ref[i];
        this.compile(s);
        if (i < this.program.statements.length - 1) {
          this.routine.POP(s);
        }
      }
      this.routine.optimize();
      this.routine.resolveLabels();
      this.count += this.routine.opcodes.length;
      this.routine.locals_size = this.locals.max_index;
    }

    
    // console.info(JSON.stringify @routine.export())
    // @routine = new Routine(0).import( @routine.export() )
    compile(statement) {
      if (statement instanceof Program.Value) {
        return this.compileValue(statement);
      } else if (statement instanceof Program.Operation) {
        return this.compileOperation(statement);
      } else if (statement instanceof Program.Assignment) {
        return this.compileAssignment(statement);
      } else if (statement instanceof Program.Variable) {
        return this.compileVariable(statement);
      } else if (statement instanceof Program.Function) {
        return this.compileFunction(statement);
      } else if (statement instanceof Program.FunctionCall) {
        return this.compileFunctionCall(statement);
      } else if (statement instanceof Program.While) {
        return this.compileWhile(statement);
      }
      if (statement instanceof Program.SelfAssignment) {
        return this.compileSelfAssignment(statement);
      } else if (statement instanceof Program.Braced) {
        return this.compileBraced(statement);
      } else if (statement instanceof Program.CreateObject) {
        return this.compileCreateObject(statement);
      } else if (statement instanceof Program.Field) {
        return this.compileField(statement);
      } else if (statement instanceof Program.Negate) {
        return this.compileNegate(statement);
      } else if (statement instanceof Program.For) {
        return this.compileFor(statement);
      } else if (statement instanceof Program.ForIn) {
        return this.compileForIn(statement);
      } else if (statement instanceof Program.Not) {
        return this.compileNot(statement);
      } else if (statement instanceof Program.Return) {
        return this.compileReturn(statement);
      } else if (statement instanceof Program.Condition) {
        return this.compileCondition(statement);
      } else if (statement instanceof Program.Break) {
        return this.compileBreak(statement);
      } else if (statement instanceof Program.Continue) {
        return this.compileContinue(statement);
      } else if (statement instanceof Program.CreateClass) {
        return this.compileCreateClass(statement);
      } else if (statement instanceof Program.NewCall) {
        return this.compileNewCall(statement);
      } else if (statement instanceof Program.After) {
        return this.compileAfter(statement);
      } else if (statement instanceof Program.Every) {
        return this.compileEvery(statement);
      } else if (statement instanceof Program.Do) {
        return this.compileDo(statement);
      } else if (statement instanceof Program.Sleep) {
        return this.compileSleep(statement);
      } else if (statement instanceof Program.Delete) {
        return this.compileDelete(statement);
      } else if (true) {
        console.info(statement);
        throw "Not implemented";
      }
    }

    compileAssignment(statement) {
      var arg_index, f, i, index, j, ref;
      if (statement.local) {
        if (statement.field instanceof Program.Variable) {
          if (statement.expression instanceof Program.Function) {
            index = this.locals.register(statement.field.identifier); //# register function locally first
            this.compile(statement.expression); //# then compile function which may refer to itself
            this.routine.arg1[this.routine.arg1.length - 1].import_self = index;
            return this.routine.STORE_LOCAL(index, statement);
          } else if (statement.expression instanceof Program.After || statement.expression instanceof Program.Do || statement.expression instanceof Program.Every) {
            index = this.locals.register(statement.field.identifier); //# register thread locally first
            arg_index = this.routine.arg1.length; //# thread main routine will land here
            this.compile(statement.expression); //# then compile function which may refer to itself
            this.routine.arg1[arg_index].import_self = index;
            return this.routine.STORE_LOCAL(index, statement);
          } else {
            this.compile(statement.expression); //# first compile expression which may refer to another local with same name
            index = this.locals.register(statement.field.identifier); //# then register a local for that name
            return this.routine.STORE_LOCAL(index, statement);
          }
        } else {
          throw "illegal";
        }
      } else {
        if (statement.field instanceof Program.Variable) {
          if (this.locals.get(statement.field.identifier) != null) {
            this.compile(statement.expression);
            index = this.locals.get(statement.field.identifier);
            this.routine.STORE_LOCAL(index, statement);
          } else if (statement.expression instanceof Program.CreateClass) {
            return this.compileUpdateClass(statement.expression, statement.field.identifier);
          } else {
            this.compile(statement.expression);
            this.routine.STORE_VARIABLE(statement.field.identifier, statement);
          }
        } else {
          f = statement.field;
          if (f.expression instanceof Program.Variable) {
            if (f.expression.identifier === "this") {
              this.routine.LOAD_THIS(f);
            } else if (this.locals.get(f.expression.identifier) != null) {
              index = this.locals.get(f.expression.identifier);
              this.routine.LOAD_LOCAL_OBJECT(index, f.expression);
            } else if (f.expression.identifier === "global") {
              this.routine.LOAD_GLOBAL(f);
            } else {
              this.routine.LOAD_VARIABLE_OBJECT(f.expression.identifier, statement);
            }
          } else {
            this.compile(f.expression);
            this.routine.MAKE_OBJECT(statement);
          }
          for (i = j = 0, ref = f.chain.length - 2; j <= ref; i = j += 1) {
            this.compile(f.chain[i]);
            this.routine.LOAD_PROPERTY_OBJECT(f.chain[i]);
          }
          this.compile(f.chain[f.chain.length - 1]);
          this.compile(statement.expression);
          return this.routine.STORE_PROPERTY(statement);
        }
      }
    }

    compileSelfAssignment(statement) {
      var c, f, i, index, j, op, ref;
      switch (statement.operation) {
        case Token.TYPE_PLUS_EQUALS:
          op = "ADD";
          break;
        case Token.TYPE_MINUS_EQUALS:
          op = "SUB";
          break;
        case Token.TYPE_MULTIPLY_EQUALS:
          op = "MUL";
          break;
        case Token.TYPE_DIVIDE_EQUALS:
          op = "DIV";
          break;
        case Token.TYPE_MODULO_EQUALS:
          op = "MODULO";
          break;
        case Token.TYPE_AND_EQUALS:
          op = "BINARY_AND";
          break;
        case Token.TYPE_OR_EQUALS:
          op = "BINARY_OR";
      }
      if (statement.field instanceof Program.Variable) {
        if (this.locals.get(statement.field.identifier) != null) {
          index = this.locals.get(statement.field.identifier);
          this.routine.LOAD_LOCAL(index, statement);
          this.compile(statement.expression);
          this.routine[op](statement, 1);
          this.routine.STORE_LOCAL(index, statement);
        } else {
          this.routine.LOAD_VARIABLE(statement.field.identifier, statement);
          this.compile(statement.expression);
          this.routine[op](statement, 1);
          this.routine.STORE_VARIABLE(statement.field.identifier, statement);
        }
      } else {
        f = statement.field;
        if (f.expression instanceof Program.Variable) {
          if (f.expression.identifier === "this") {
            this.routine.LOAD_THIS(f);
          } else if (this.locals.get(f.expression.identifier) != null) {
            index = this.locals.get(f.expression.identifier);
            this.routine.LOAD_LOCAL_OBJECT(index, statement);
          } else if (f.expression.identifier === "global") {
            this.routine.LOAD_GLOBAL(f);
          } else {
            this.routine.LOAD_VARIABLE_OBJECT(f.expression.identifier, statement);
          }
        } else {
          this.compile(f.expression);
          this.routine.MAKE_OBJECT(statement);
        }
        for (i = j = 0, ref = f.chain.length - 2; j <= ref; i = j += 1) {
          this.compile(f.chain[i]);
          this.routine.LOAD_PROPERTY_OBJECT(f.chain[i]);
        }
        c = f.chain[f.chain.length - 1];
        this.compile(f.chain[f.chain.length - 1]);
        this.routine.LOAD_PROPERTY_ATOP(statement);
        this.compile(statement.expression);
        this.routine[op](statement, 1);
        return this.routine.STORE_PROPERTY(statement);
      }
    }

    compileOperation(op) {
      var jump, ref, ref1;
      if ((ref = op.operation) === "+" || ref === "-" || ref === "*" || ref === "/" || ref === "%" || ref === "&" || ref === "|" || ref === "<<" || ref === ">>") {
        this.compile(op.term1);
        this.compile(op.term2);
        switch (op.operation) {
          case "+":
            this.routine.ADD(op);
            break;
          case "-":
            this.routine.SUB(op);
            break;
          case "*":
            this.routine.MUL(op);
            break;
          case "/":
            this.routine.DIV(op);
            break;
          case "%":
            this.routine.MODULO(op);
            break;
          case "&":
            this.routine.BINARY_AND(op);
            break;
          case "|":
            this.routine.BINARY_OR(op);
            break;
          case "<<":
            this.routine.SHIFT_LEFT(op);
            break;
          case ">>":
            this.routine.SHIFT_RIGHT(op);
        }
      } else if ((ref1 = op.operation) === "==" || ref1 === "!=" || ref1 === "<" || ref1 === ">" || ref1 === "<=" || ref1 === ">=") {
        this.compile(op.term1);
        this.compile(op.term2);
        switch (op.operation) {
          case "==":
            this.routine.EQ(op);
            break;
          case "!=":
            this.routine.NEQ(op);
            break;
          case "<":
            this.routine.LT(op);
            break;
          case ">":
            this.routine.GT(op);
            break;
          case "<=":
            this.routine.LTE(op);
            break;
          case ">=":
            this.routine.GTE(op);
        }
      } else if (op.operation === "and") {
        jump = this.routine.createLabel("and");
        op.term1.nowarning = true;
        op.term2.nowarning = true;
        this.compile(op.term1);
        this.routine.JUMPN_NOPOP(jump, op);
        this.routine.POP(op);
        this.compile(op.term2);
        return this.routine.setLabel(jump);
      } else if (op.operation === "or") {
        jump = this.routine.createLabel("or");
        op.term1.nowarning = true;
        op.term2.nowarning = true;
        this.compile(op.term1);
        this.routine.JUMPY_NOPOP(jump, op);
        this.routine.POP(op);
        this.compile(op.term2);
        return this.routine.setLabel(jump);
      } else if (op.operation === "^") {
        this.compile(op.term1);
        this.compile(op.term2);
        return this.routine.BINARY_OP(Compiler.predefined_binary_functions.pow, op);
      } else {
        return "";
      }
    }

    compileBraced(expression) {
      this.compile(expression.expression);
    }

    compileNegate(expression) {
      if (expression.expression instanceof Program.Value && expression.expression.type === Program.Value.TYPE_NUMBER) {
        return this.routine.LOAD_VALUE(-expression.expression.value, expression);
      } else {
        this.compile(expression.expression);
        return this.routine.NEGATE(expression);
      }
    }

    compileNot(expression) {
      expression.expression.nowarning = true;
      this.compile(expression.expression);
      return this.routine.NOT(expression);
    }

    compileValue(value) {
      var i, j, ref;
      switch (value.type) {
        case Program.Value.TYPE_NUMBER:
          this.routine.LOAD_VALUE(value.value, value);
          break;
        case Program.Value.TYPE_STRING:
          this.routine.LOAD_VALUE(value.value, value);
          break;
        case Program.Value.TYPE_ARRAY:
          this.routine.CREATE_ARRAY(value);
          for (i = j = 0, ref = value.value.length - 1; j <= ref; i = j += 1) {
            this.routine.LOAD_VALUE(i, value);
            this.compile(value.value[i]);
            this.routine.CREATE_PROPERTY(value);
          }
      }
    }

    compileVariable(variable) {
      var index, v;
      v = variable.identifier;
      if (v === "this") {
        return this.routine.LOAD_THIS(variable);
      } else if (v === "global") {
        return this.routine.LOAD_GLOBAL(variable);
      } else if (Compiler.predefined_values[v] != null) {
        return this.routine.LOAD_VALUE(Compiler.predefined_values[v], variable);
      } else if (this.locals.get(v) != null) {
        index = this.locals.get(v);
        return this.routine.LOAD_LOCAL(index, variable);
      } else {
        return this.routine.LOAD_VARIABLE(v, variable);
      }
    }

    compileField(field) {
      var c, i, id, index, j, k, len, ref, ref1;
      if (field.expression.identifier === "keyboard" || field.expression.identifier === "gamepad") {
        field.nowarning = true;
      }
      c = field.chain[field.chain.length - 1];
      if (c instanceof Program.Value && c.value === "type") {
        if (field.chain.length === 1) {
          if (field.expression instanceof Program.Variable) { // variable.type
            id = field.expression.identifier;
            if (this.locals.get(id) != null) {
              index = this.locals.get(id);
              this.routine.LOAD_LOCAL(index, field);
              this.routine.TYPE(field);
            } else if (Compiler.predefined_values[id] != null) {
              this.routine.LOAD_VALUE("number", field);
            } else if ((Compiler.predefined_unary_functions[id] != null) || Compiler.predefined_binary_functions[id]) {
              this.routine.LOAD_VALUE("function", field);
            } else {
              this.routine.VARIABLE_TYPE(id, field.expression);
            }
          } else {
            this.compile(field.expression);
            this.routine.TYPE(field);
          }
        } else {
          this.compile(field.expression);
          for (i = j = 0, ref = field.chain.length - 3; j <= ref; i = j += 1) {
            this.compile(field.chain[i]);
            this.routine.LOAD_PROPERTY(field);
          }
          this.compile(field.chain[field.chain.length - 2]);
          this.routine.PROPERTY_TYPE(field.expression);
        }
      } else {
        this.compile(field.expression);
        ref1 = field.chain;
        for (k = 0, len = ref1.length; k < len; k++) {
          c = ref1[k];
          this.compile(c);
          this.routine.LOAD_PROPERTY(field);
        }
      }
    }

    compileFieldParent(field) {
      var c, i, j, ref;
      this.compile(field.expression);
      for (i = j = 0, ref = field.chain.length - 2; j <= ref; i = j += 1) {
        c = field.chain[i];
        this.compile(c);
        this.routine.LOAD_PROPERTY(field);
      }
    }

    compileFunctionCall(call) {
      var a, funk, i, index, j, k, l, len, len1, len2, len3, len4, m, n, ref, ref1, ref2, ref3, ref4;
      if (call.expression instanceof Program.Field) {
        ref = call.args;
        for (i = j = 0, len = ref.length; j < len; i = ++j) {
          a = ref[i];
          this.compile(a);
        }
        this.compileFieldParent(call.expression);
        this.compile(call.expression.chain[call.expression.chain.length - 1]);
        return this.routine.FUNCTION_APPLY_PROPERTY(call.args.length, call);
      } else if (call.expression instanceof Program.Variable) {
        if (Compiler.predefined_unary_functions[call.expression.identifier] != null) {
          funk = Compiler.predefined_unary_functions[call.expression.identifier];
          if (call.args.length > 0) {
            this.compile(call.args[0]);
          } else {
            this.routine.LOAD_VALUE(0, call);
          }
          return this.routine.UNARY_OP(funk, call);
        } else if (Compiler.predefined_binary_functions[call.expression.identifier] != null) {
          funk = Compiler.predefined_binary_functions[call.expression.identifier];
          if (call.args.length > 0) {
            this.compile(call.args[0]);
          } else {
            this.routine.LOAD_VALUE(0, call);
          }
          if (call.args.length > 1) {
            this.compile(call.args[1]);
          } else {
            this.routine.LOAD_VALUE(0, call);
          }
          return this.routine.BINARY_OP(funk, call);
        } else if (call.expression.identifier === "super") {
          ref1 = call.args;
          for (i = k = 0, len1 = ref1.length; k < len1; i = ++k) {
            a = ref1[i];
            this.compile(a);
          }
          return this.routine.SUPER_CALL(call.args.length, call);
        } else if (this.locals.get(call.expression.identifier) != null) {
          ref2 = call.args;
          for (i = l = 0, len2 = ref2.length; l < len2; i = ++l) {
            a = ref2[i];
            this.compile(a);
          }
          index = this.locals.get(call.expression.identifier);
          this.routine.LOAD_LOCAL(index, call);
          return this.routine.FUNCTION_CALL(call.args.length, call);
        } else {
          ref3 = call.args;
          for (i = m = 0, len3 = ref3.length; m < len3; i = ++m) {
            a = ref3[i];
            this.compile(a);
          }
          this.routine.LOAD_VALUE(call.expression.identifier, call);
          return this.routine.FUNCTION_APPLY_VARIABLE(call.args.length, call);
        }
      } else {
        ref4 = call.args;
        for (n = 0, len4 = ref4.length; n < len4; n++) {
          a = ref4[n];
          this.compile(a);
        }
        this.compile(call.expression);
        return this.routine.FUNCTION_CALL(call.args.length, call);
      }
    }

    compileFor(forloop) {
      var for_continue, for_end, for_start, iterator, save_break, save_continue;
      iterator = this.locals.register(forloop.iterator);
      this.locals.allocate(); // range_to
      this.locals.allocate(); // step
      this.compile(forloop.range_from);
      this.routine.STORE_LOCAL(iterator, forloop);
      this.routine.POP(forloop);
      this.compile(forloop.range_to);
      if (forloop.range_by !== 0) {
        this.compile(forloop.range_by);
      } else {
        this.routine.LOAD_VALUE(0, forloop);
      }
      for_start = this.routine.createLabel("for_start");
      for_continue = this.routine.createLabel("for_continue");
      for_end = this.routine.createLabel("for_end");
      this.routine.FORLOOP_INIT([iterator, for_end], forloop);
      this.routine.setLabel(for_start);
      this.locals.push();
      save_break = this.break_label;
      save_continue = this.continue_label;
      this.break_label = for_end;
      this.continue_label = for_continue;
      this.compileSequence(forloop.sequence);
      this.break_label = save_break;
      this.continue_label = save_continue;
      this.routine.setLabel(for_continue);
      this.routine.FORLOOP_CONTROL([iterator, for_start], forloop);
      this.routine.setLabel(for_end);
      return this.locals.pop();
    }

    compileForIn(forloop) {
      var for_continue, for_end, for_start, iterator, save_break, save_continue;
      iterator = this.locals.register(forloop.iterator);
      this.locals.allocate(); // array
      this.locals.allocate(); // index
      this.compile(forloop.list);
      for_start = this.routine.createLabel("for_start");
      for_continue = this.routine.createLabel("for_continue");
      for_end = this.routine.createLabel("for_end");
      this.routine.FORIN_INIT([iterator, for_end], forloop);
      this.routine.setLabel(for_start);
      this.locals.push();
      save_break = this.break_label;
      save_continue = this.continue_label;
      this.break_label = for_end;
      this.continue_label = for_continue;
      this.compileSequence(forloop.sequence);
      this.break_label = save_break;
      this.continue_label = save_continue;
      this.routine.setLabel(for_continue);
      this.routine.FORIN_CONTROL([iterator, for_start], forloop);
      this.routine.setLabel(for_end);
      return this.locals.pop();
    }

    compileSequence(sequence) {
      var i, j, ref;
      for (i = j = 0, ref = sequence.length - 1; j <= ref; i = j += 1) {
        if (!sequence[i].nopop) {
          this.routine.POP(sequence[i]);
        }
        this.compile(sequence[i]);
      }
    }

    compileWhile(whiloop) {
      var end, save_break, save_continue, start;
      this.locals.push();
      start = this.routine.createLabel("while_start");
      end = this.routine.createLabel("while_end");
      this.routine.LOAD_VALUE(0, whiloop);
      this.routine.setLabel(start);
      this.compile(whiloop.condition);
      this.routine.JUMPN(end);
      save_break = this.break_label;
      save_continue = this.continue_label;
      this.break_label = end;
      this.continue_label = start;
      this.compileSequence(whiloop.sequence);
      this.routine.JUMP(start, whiloop);
      this.break_label = save_break;
      this.continue_label = save_continue;
      this.routine.setLabel(end);
      return this.locals.pop();
    }

    compileBreak(statement) {
      if (this.break_label != null) {
        return this.routine.JUMP(this.break_label);
      }
    }

    compileContinue(statement) {
      if (this.continue_label != null) {
        return this.routine.JUMP(this.continue_label);
      }
    }

    compileFunction(func) {
      var r;
      r = this.compileFunctionBody(func);
      return this.routine.LOAD_ROUTINE(r, func);
    }

    compileFunctionBody(func) {
      var a, args, i, index, j, k, l, label, len, local_index, locals, m, numargs, r, ref, ref1, ref2, ref3, routine;
      routine = this.routine;
      locals = this.locals;
      this.routine = new Routine(func.args != null ? func.args.length : 0);
      this.locals = new Locals(this, locals);
      local_index = this.locals.index;
      this.routine.uses_arguments = true;
      if (func.args != null) {
        if (this.routine.uses_arguments) {
          args = this.locals.register("arguments");
          this.routine.STORE_LOCAL(args, func);
          this.routine.POP(func);
        }
        numargs = this.locals.register("+numargs");
        this.routine.STORE_LOCAL(numargs, func);
        this.routine.POP(func);
        for (i = j = ref = func.args.length - 1; j >= 0; i = j += -1) {
          a = func.args[i];
          index = this.locals.register(a.name);
          this.routine.STORE_LOCAL(index, func);
          this.routine.POP(func);
        }
        for (i = k = 0, ref1 = func.args.length - 1; k <= ref1; i = k += 1) {
          a = func.args[i];
          if (a.default != null) {
            index = this.locals.get(a.name);
            label = this.routine.createLabel("default_arg");
            this.routine.LOAD_VALUE(i, func);
            this.routine.LOAD_LOCAL(numargs, func);
            this.routine.LT(func);
            this.routine.JUMPY(label, func);
            this.compile(a.default);
            this.routine.STORE_LOCAL(index, func);
            this.routine.POP(func);
            this.routine.setLabel(label);
          }
        }
      }
      if (func.sequence.length > 0) {
        for (i = l = 0, ref2 = func.sequence.length - 1; l <= ref2; i = l += 1) {
          this.compile(func.sequence[i]);
          if (i < func.sequence.length - 1) {
            this.routine.POP(func.sequence[i]);
          } else {
            this.routine.RETURN(func.sequence[i]);
          }
        }
      } else {
        this.routine.LOAD_VALUE(0, func);
        this.routine.RETURN(func);
      }
      if ((func.args != null) && !this.locals.arguments_used) {
        this.routine.uses_arguments = false;
        this.routine.remove(0);
        this.routine.remove(0);
      }
      index = 0;
      ref3 = this.locals.imports;
      for (m = 0, len = ref3.length; m < len; m++) {
        i = ref3[m];
        this.routine.OP_INSERT(OPCODES.LOAD_IMPORT, func, index, index * 3);
        this.routine.OP_INSERT(OPCODES.STORE_LOCAL, func, i.index, index * 3 + 1);
        this.routine.OP_INSERT(OPCODES.POP, func, 0, index * 3 + 2);
        this.routine.import_refs.push(i.source);
        index += 1;
      }
      this.routine.optimize();
      this.routine.resolveLabels();
      this.count += this.routine.opcodes.length;
      r = this.routine;
      // console.info r.toString()
      this.routine.locals_size = this.locals.max_index;
      this.routine = routine;
      this.locals = locals;
      return r;
    }

    compileReturn(ret) {
      if (ret.expression != null) {
        this.compile(ret.expression);
        return this.routine.RETURN(ret);
      } else {
        this.routine.LOAD_VALUE(0, ret);
        return this.routine.RETURN(ret);
      }
    }

    compileCondition(condition) {
      var c, chain, condition_end, condition_next, i, j, ref;
      chain = condition.chain;
      this.routine.LOAD_VALUE(0, condition);
      condition_end = this.routine.createLabel("condition_end");
      for (i = j = 0, ref = chain.length - 1; j <= ref; i = j += 1) {
        condition_next = this.routine.createLabel("condition_next");
        c = chain[i];
        c.condition.nowarning = true;
        this.compile(c.condition);
        this.routine.JUMPN(condition_next);
        this.locals.push();
        this.compileSequence(c.sequence);
        this.locals.pop();
        this.routine.JUMP(condition_end, condition);
        this.routine.setLabel(condition_next);
        if (i === chain.length - 1 && (c.else != null)) {
          this.locals.push();
          this.compileSequence(c.else);
          this.locals.pop();
        }
      }
      this.routine.setLabel(condition_end);
    }

    formatField(field) {
      if (field === "constructor") {
        field = "_constructor";
      }
      return field.toString().replace(/"/g, "\\\"");
    }

    compileCreateObject(statement) {
      var f, j, len, ref;
      this.routine.CREATE_OBJECT(statement);
      ref = statement.fields;
      for (j = 0, len = ref.length; j < len; j++) {
        f = ref[j];
        this.routine.LOAD_VALUE(f.field, statement);
        this.compile(f.value);
        this.routine.CREATE_PROPERTY(statement);
      }
    }

    compileCreateClass(statement) {
      var f, j, len, ref, variable;
      if (statement.ext != null) {
        statement.ext.nowarning = true;
        this.compile(statement.ext);
      } else {
        this.routine.LOAD_VALUE(0, statement);
      }
      variable = (statement.ext != null) && statement.ext instanceof Program.Variable ? statement.ext.identifier : 0;
      this.routine.CREATE_CLASS(variable, statement);
      ref = statement.fields;
      for (j = 0, len = ref.length; j < len; j++) {
        f = ref[j];
        this.routine.LOAD_VALUE(f.field, statement);
        this.compile(f.value);
        this.routine.CREATE_PROPERTY(statement);
      }
    }

    compileUpdateClass(statement, variable) {
      this.compileCreateClass(statement);
      return this.routine.UPDATE_CLASS(variable, statement);
    }

    compileNewCall(statement) {
      var a, call, i, j, len, ref;
      call = statement.expression;
      this.routine.LOAD_VALUE(0, statement); // reserve spot on stack for the class instance
      ref = call.args;
      for (i = j = 0, len = ref.length; j < len; i = ++j) {
        a = ref[i];
        this.compile(a);
      }
      this.compile(call.expression);
      this.routine.NEW_CALL(call.args.length, statement);
      return this.routine.POP(statement); // pop return value of class constructor
    }

    compileAfter(after) {
      var r;
      r = this.compileFunctionBody(after);
      this.routine.LOAD_ROUTINE(r, after);
      this.compile(after.delay);
      if ((after.multiplier != null) && after.multiplier !== 1) {
        this.routine.LOAD_VALUE(after.multiplier, after);
        this.routine.MUL(after);
      }
      return this.routine.AFTER(after);
    }

    compileEvery(every) {
      var r;
      r = this.compileFunctionBody(every);
      this.routine.LOAD_ROUTINE(r, every);
      this.compile(every.delay);
      if ((every.multiplier != null) && every.multiplier !== 1) {
        this.routine.LOAD_VALUE(every.multiplier, every);
        this.routine.MUL(every);
      }
      return this.routine.EVERY(every);
    }

    compileDo(dostuff) {
      var r;
      r = this.compileFunctionBody(dostuff);
      this.routine.LOAD_ROUTINE(r, dostuff);
      return this.routine.DO(dostuff);
    }

    compileSleep(sleep) {
      this.compile(sleep.delay);
      if ((sleep.multiplier != null) && sleep.multiplier !== 1) {
        this.routine.LOAD_VALUE(sleep.multiplier, sleep);
        this.routine.MUL(sleep);
      }
      return this.routine.SLEEP(sleep);
    }

    compileDelete(del) {
      var chain, i, j, ref;
      if (del.field instanceof Program.Variable) {
        this.routine.LOAD_THIS(del);
        this.routine.LOAD_VALUE(del.field.identifier, del);
        this.routine.DELETE(del);
      } else {
        this.compile(del.field.expression);
        chain = del.field.chain;
        for (i = j = 0, ref = chain.length - 1; j <= ref; i = j += 1) {
          this.compile(chain[i]);
          if (i < chain.length - 1) {
            this.routine.LOAD_PROPERTY(del);
          }
        }
        this.routine.DELETE(del);
      }
    }

    exec(context) {
      this.processor = new Processor();
      this.processor.load(this.routine);
      return this.processor.run(context);
    }

  };

  Compiler.predefined_unary_functions = {
    "round": Math.round,
    "floor": Math.floor,
    "ceil": Math.ceil,
    "abs": Math.abs,
    "sqrt": Math.sqrt,
    "sin": Math.sin,
    "cos": Math.cos,
    "tan": Math.tan,
    "acos": Math.acos,
    "asin": Math.asin,
    "atan": Math.atan,
    "sind": function(x) {
      return Math.sin(x * Math.PI / 180);
    },
    "cosd": function(x) {
      return Math.cos(x * Math.PI / 180);
    },
    "tand": function(x) {
      return Math.tan(x * Math.PI / 180);
    },
    "asind": function(x) {
      return Math.asin(x) / Math.PI * 180;
    },
    "acosd": function(x) {
      return Math.acos(x) / Math.PI * 180;
    },
    "atand": function(x) {
      return Math.atan(x) / Math.PI * 180;
    },
    "log": Math.log,
    "exp": Math.exp
  };

  Compiler.predefined_binary_functions = {
    "min": Math.min,
    "max": Math.max,
    "pow": Math.pow,
    "atan2": Math.atan2,
    "atan2d": function(y, x) {
      return Math.atan2(y, x) / Math.PI * 180;
    }
  };

  Compiler.predefined_values = {
    PI: Math.PI,
    true: 1,
    false: 0
  };

  return Compiler;

}).call(this);

this.Locals = class Locals {
  constructor(compiler, parent = null) {
    this.compiler = compiler;
    this.parent = parent;
    this.layers = [];
    this.index = 0;
    this.max_index = 0;
    this.push();
    this.imports = [];
  }

  increment() {
    var spot;
    spot = this.index++;
    this.max_index = Math.max(this.index, this.max_index);
    return spot;
  }

  push() {
    return this.layers.push(new LocalLayer(this));
  }

  pop() {
    // resetting the @index below was causing erasure of outer locals
    // when used after the block ; such reset is not needed
    //@index = @layers[@layers.length-1].start_index
    return this.layers.splice(this.layers.length - 1, 1);
  }

  register(name) {
    return this.layers[this.layers.length - 1].register(name);
  }

  allocate() {
    return this.layers[this.layers.length - 1].allocate();
  }

  get(name) {
    var i, index, j, ref, v;
    if (name === "arguments") {
      this.arguments_used = true;
    }
    for (i = j = ref = this.layers.length - 1; j >= 0; i = j += -1) {
      v = this.layers[i].get(name);
      if (v != null) {
        return v;
      }
    }
    if (this.parent != null) {
      v = this.parent.get(name);
      if (v != null) {
        index = this.register(name);
        this.imports.push({
          name: name,
          index: index,
          source: v
        });
        return index;
      }
    }
    return null;
  }

};

LocalLayer = class LocalLayer {
  constructor(locals1) {
    this.locals = locals1;
    this.start_index = this.locals.index;
    this.registered = {};
  }

  register(name) {
    return this.registered[name] = this.locals.increment();
  }

  allocate() {
    return this.locals.increment();
  }

  get(name) {
    if (this.registered[name] != null) {
      return this.registered[name];
    } else {
      return null;
    }
  }

};

var Transpiler;

Transpiler = (function() {
  function Transpiler() {}

  Transpiler.prototype.transpile = function(r) {
    var i, j, l, op, ref, results;
    results = [];
    for (i = l = 0, ref = r.opcodes.length - 1; l <= ref; i = l += 1) {
      op = OPCODES[r.opcodes[i]];
      if (this.transpilable(op, r.arg1[i])) {
        j = i + 1;
        while (j < r.opcodes.length && r.removeable(j) && this.transpilable(OPCODES[r.opcodes[j]], r.arg1[j])) {
          j += 1;
        }
        j -= 1;
        if (j - i >= 2) {
          results.push(this.transpileSegment(r, i, j));
        } else {
          results.push(void 0);
        }
      } else {
        results.push(void 0);
      }
    }
    return results;
  };

  Transpiler.prototype.transpileSegment = function(r, i, j) {
    var comp, err, index, k, l, m, ref, ref1, ref2, ref3, s;
    this.vcount = 0;
    this.stack = new Stack();
    this.locals = {};
    this.variables = {};
    s = "f = function(stack,stack_index,locals,locals_offset,object,global) {\n";
    for (k = l = ref = i, ref1 = j; l <= ref1; k = l += 1) {
      console.info(OPCODES[r.opcodes[k]] + " " + r.arg1[k]);
      comp = this[OPCODES[r.opcodes[k]]](r.arg1[k]);
      if (comp) {
        s += comp + "\n";
      }
    }
    for (index in this.stack.touched) {
      if (this.stack.touched[index]) {
        if (index < 0) {
          s += "stack[stack_index-" + (Math.abs(index)) + "] = " + this.stack.stack[index] + " ;\n";
        } else if (index > 0) {
          s += "stack[stack_index+" + index + "] = " + this.stack.stack[index] + " ;\n";
        } else {
          s += "stack[stack_index] = " + this.stack.stack[index] + " ;\n";
        }
      }
    }
    if (this.stack.index < 0) {
      s += "stack_index -= " + (Math.abs(this.stack.index)) + " ;\n";
    } else if (this.stack.index > 0) {
      s += "stack_index += " + this.stack.index + " ;\n";
    }
    s += "return stack_index ;\n}";
    console.info(s);
    try {
      eval(s);
    } catch (error) {
      err = error;
      console.error(s);
      console.error(err);
    }
    r.opcodes[i] = 200;
    r.arg1[i] = f;
    for (k = m = ref2 = i + 1, ref3 = j; m <= ref3; k = m += 1) {
      r.remove(i + 1);
    }
  };

  Transpiler.prototype.createVariable = function() {
    return "v" + (this.vcount++);
  };

  Transpiler.prototype.transpilable = function(op, arg) {
    var ref;
    if (op === "LOAD_VALUE") {
      return (ref = typeof arg) === "string" || ref === "number";
    } else {
      return this[op] != null;
    }
  };

  Transpiler.prototype.LOAD_VALUE = function(arg) {
    if (typeof arg === "string") {
      this.stack.push(" \"" + (arg.replace(/"/g, "\\\"")) + "\" ");
    } else if (typeof arg === "number") {
      this.stack.push(arg + "");
    }
    return "";
  };

  Transpiler.prototype.LOAD_LOCAL = function(arg) {
    var v;
    v = this.createVariable();
    this.stack.push(v);
    return "let " + v + " = locals[locals_offset+" + arg + "] ; // LOAD_LOCAL";
  };

  Transpiler.prototype.LOAD_LOCAL_OBJECT = function(arg) {
    var res, v;
    if (this.locals[arg] != null) {
      v = this.locals[arg];
      this.stack.push(v);
      return "if (typeof " + v + " != \"object\") { " + v + " = locals[locals_offset+" + arg + "] = {} } ;";
    } else {
      v = this.createVariable();
      res = "let " + v + " = locals[locals_offset+" + arg + "] ;\nif (typeof " + v + " != \"object\") { " + v + " = locals[locals_offset+" + arg + "] = {} } ;";
      this.stack.push(v);
      this.locals[arg] = v;
      return res;
    }
  };

  Transpiler.prototype.STORE_LOCAL = function(arg) {
    var v;
    v = this.stack.get();
    return "locals[locals_offset+" + arg + "] = " + v + " ; // STORE_LOCAL";
  };

  Transpiler.prototype.POP = function() {
    this.stack.pop();
    return "";
  };

  Transpiler.prototype.CREATE_PROPERTY = function(arg) {
    var res;
    res = (this.stack.get(-2)) + "[" + (this.stack.get(-1)) + "] = " + (this.stack.get()) + " ;";
    this.stack.pop();
    this.stack.pop();
    return res;
  };

  Transpiler.prototype.LOAD_PROPERTY = function(arg) {
    var res, v;
    v = this.createVariable();
    res = "let " + v + " = " + (this.stack.get(-1)) + "[" + (this.stack.get()) + "] ; // LOAD_PROPERTY\nif (" + v + " == null) { " + v + " = 0 ; }";
    this.stack.pop();
    this.stack.pop();
    this.stack.push(v);
    return res;
  };

  Transpiler.prototype.LOAD_PROPERTY_ATOP = function(arg) {
    var res, v;
    v = this.createVariable();
    res = "let " + v + " = " + (this.stack.get(-1)) + "[" + (this.stack.get()) + "] ; // LOAD_PROPERTY_ATOP\nif (" + v + " == null) { " + v + " = 0 ; }";
    this.stack.push(v);
    return res;
  };

  Transpiler.prototype.NEW_OBJECT = function() {
    var v;
    v = this.createVariable();
    this.stack.push(v);
    return "let " + v + " = {} ;";
  };

  Transpiler.prototype.NEW_ARRAY = function() {
    var v;
    v = this.createVariable();
    this.stack.push(v);
    return "let " + v + " = [] ;";
  };

  Transpiler.prototype.MAKE_OBJECT = function() {
    var res, v;
    v = this.createVariable();
    res = "let " + v + " = " + (this.stack.get()) + " ;\nif (typeof " + v + " != \"object\") " + v + " = {} ; ";
    this.stack.pop();
    this.stack.push(v);
    return res;
  };

  Transpiler.prototype.STORE_VARIABLE = function(arg) {
    if (this.variables[arg] != null) {
      return this.variables[arg] + " = object[\"" + arg + "\"] = " + (this.stack.get()) + " ; // STORE_VARIABLE";
    } else {
      return "object[\"" + arg + "\"] = " + (this.stack.get()) + " ; // STORE_VARIABLE";
    }
  };

  Transpiler.prototype.STORE_PROPERTY = function(arg) {
    var res, v;
    v = this.createVariable();
    res = "let " + v + " = " + (this.stack.get(-2)) + "[" + (this.stack.get(-1)) + "] = " + (this.stack.get(0)) + " ; // STORE_PROPERTY";
    this.stack.pop();
    this.stack.pop();
    this.stack.pop();
    this.stack.push(v);
    return res;
  };

  return Transpiler;

})();

this.Stack = (function() {
  function Stack() {
    this.stack = ["stack[stack_index]"];
    this.index = 0;
    this.touched = {};
  }

  Stack.prototype.push = function(value) {
    this.stack[++this.index] = value;
    return this.touched[this.index] = true;
  };

  Stack.prototype.pop = function() {
    var res;
    if (this.index >= 0) {
      res = this.stack.splice(this.index, 1)[0];
    } else if (this.stack[this.index] != null) {
      res = this.stack[this.index];
    } else {
      res = "stack[stack_index-" + this.index + "]";
    }
    this.index -= 1;
    return res;
  };

  Stack.prototype.get = function(index) {
    var i;
    if (index == null) {
      index = 0;
    }
    i = this.index + index;
    if (i >= 0) {
      return this.stack[i];
    } else if (this.stack[i] != null) {
      return this.stack[i];
    } else {
      return "stack[stack_index-" + (-i) + "]";
    }
  };

  return Stack;

})();

class MicroScriptRunner {
  constructor(microvm) {
    this.microvm = microvm;
  }

  init() {
    this.initialized = true;
    this.system = this.microvm.context.global.system;
    this.system.preemptive = 1;
    this.system.threads = [];
    this.main_thread = new Thread(this);
    this.threads = [this.main_thread];
    this.current_thread = this.main_thread;
    this.thread_index = 0;
    this.microvm.context.global.print = this.microvm.context.meta.print;
    this.microvm.context.global.random = new Random(0);
    this.microvm.context.global.Function = {
      bind: function(obj) {
        var rc;
        if (this instanceof Routine) {
          rc = this.clone();
          rc.object = obj;
          return rc;
        } else {
          return this;
        }
      }
    };
    this.microvm.context.global.List = {
      sortList: (f) => {
        var funk;
        if ((f != null) && f instanceof Program.Function) {
          funk = function(a, b) {
            return f.call(this.microvm.context.global, [a, b], true);
          };
        } else if ((f != null) && typeof f === "function") {
          funk = f;
        }
        return this.sort(funk);
      },
      "+": function(a, b, self) {
        if (!self) { // not +=, clone array a
          a = [...a];
        }
        if (Array.isArray(b)) {
          return a.concat(b);
        } else {
          a.push(b);
          return a;
        }
      },
      "-": function(a, b, self) {
        var index;
        if (!self) { // not -=, clone array a
          a = [...a];
        }
        index = a.indexOf(b);
        if (index >= 0) {
          a.splice(index, 1);
        }
        return a;
      }
    };
    this.microvm.context.global.Object = {};
    this.microvm.context.global.String = {
      fromCharCode: function(...args) { return String.fromCharCode(...args) },
      "+": function(a, b) {
        return a + b;
      }
    };
    this.microvm.context.global.Number = {
      parse: function(s) {
        var res;
        res = Number.parseFloat(s);
        if (isFinite(res)) {
          return res;
        } else {
          return 0;
        }
      },
      toString: function() {
        return this.toString();
      }
    };
    this.fps = 60;
    this.fps_max = 60;
    this.cpu_load = 0;
    this.microvm.context.meta.print("microScript 2.0");
    return this.triggers_controls_update = true;
  }

  run(src, filename, callback) {
    var compiler, err, id, j, len, parser, program, ref, result, w;
    if (!this.initialized) {
      this.init();
    }
    parser = new Parser(src, filename);
    parser.parse();
    if (parser.error_info != null) {
      err = parser.error_info;
      err.type = "compile";
      throw err;
    }
    if (parser.warnings.length > 0) {
      ref = parser.warnings;
      for (j = 0, len = ref.length; j < len; j++) {
        w = ref[j];
        id = filename + "-" + w.line + "-" + w.column;
        switch (w.type) {
          case "assigning_api_variable":
            if (this.microvm.context.warnings.assigning_api_variable[id] == null) {
              this.microvm.context.warnings.assigning_api_variable[id] = {
                file: filename,
                line: w.line,
                column: w.column,
                expression: w.identifier
              };
            }
            break;
          case "assignment_as_condition":
            if (this.microvm.context.warnings.assignment_as_condition[id] == null) {
              this.microvm.context.warnings.assignment_as_condition[id] = {
                file: filename,
                line: w.line,
                column: w.column
              };
            }
        }
      }
    }
    program = parser.program;
    compiler = new Compiler(program);
    result = null;
    compiler.routine.callback = function(res) {
      if (callback != null) {
        return callback(Program.toString(res));
      } else {
        return result = res;
      }
    };
    this.main_thread.addCall(compiler.routine);
    this.tick();
    return result;
  }

  call(name, args) {
    var f, routine;
    if (name === "draw" || name === "update" || name === "serverUpdate") {
      if (this.microvm.context.global[name] != null) {
        this.main_thread.addCall(`${name}()`);
      }
      return;
    }
    if (this.microvm.context.global[name] != null) {
      if ((args == null) || !args.length) {
        return this.main_thread.addCall(`${name}()`);
      } else {
        routine = this.microvm.context.global[name];
        if (routine instanceof Routine) {
          f = this.main_thread.processor.routineAsFunction(routine, this.microvm.context);
          return f(...args);
        } else if (typeof routine === "function") {
          return routine(...args);
        }
      }
    } else {
      return 0;
    }
  }

  toString(obj) {
    return Program.toString(obj);
  }

  process(thread, time_limit) {
    var processor;
    processor = thread.processor;
    processor.time_limit = time_limit;
    this.current_thread = thread;
    return processor.run(this.microvm.context);
  }

  tick() {
    var dt, frame_time, i, index, j, k, len, load, margin, processing, processor, ref, ref1, t, time, time_limit, time_out;
    if (this.system.fps != null) {
      this.fps = this.fps * .9 + this.system.fps * .1;
    }
    this.fps_max = Math.max(this.fps, this.fps_max);
    frame_time = Math.min(16, Math.floor(1000 / this.fps_max));
    if (this.fps < 59) {
      margin = 10;
    } else {
      margin = Math.floor(1000 / this.fps * .8);
    }
    time = Date.now();
    time_limit = time + 100; // allow more time to prevent interrupting main_thread in the middle of a draw()
    time_out = this.system.preemptive ? time_limit : 2e308;
    processor = this.main_thread.processor;
    if (!processor.done) {
      if (this.main_thread.sleep_until != null) {
        if (Date.now() >= this.main_thread.sleep_until) {
          delete this.main_thread.sleep_until;
          this.process(this.main_thread, time_out);
        }
      } else {
        this.process(this.main_thread, time_out);
      }
    }
    while (processor.done && Date.now() < time_out && this.main_thread.loadNext()) {
      this.process(this.main_thread, time_out);
    }
    time_limit = time + margin; // secondary threads get remaining time
    time_out = this.system.preemptive ? time_limit : 2e308;
    processing = true;
    while (processing) {
      processing = false;
      ref = this.threads;
      for (j = 0, len = ref.length; j < len; j++) {
        t = ref[j];
        if (t !== this.main_thread) {
          if (t.paused || t.terminated) {
            continue;
          }
          processor = t.processor;
          if (!processor.done) {
            if (t.sleep_until != null) {
              if (Date.now() >= t.sleep_until) {
                delete t.sleep_until;
                this.process(t, time_out);
                processing = true;
              }
            } else {
              this.process(t, time_out);
              processing = true;
            }
          } else if (t.start_time != null) {
            if (t.repeat) {
              while (time >= t.start_time && !(t.paused || t.terminated)) {
                if (time >= t.start_time + 150) {
                  t.start_time = time + t.delay;
                } else {
                  t.start_time += t.delay;
                }
                processor.load(t.routine);
                this.process(t, time_out);
                processing = true;
              }
            } else {
              if (time >= t.start_time) {
                delete t.start_time;
                processor.load(t.routine);
                this.process(t, time_out);
                processing = true;
              }
            }
          } else {
            t.terminated = true;
          }
        }
      }
      if (Date.now() > time_limit) {
        break;
      }
    }
    for (i = k = ref1 = this.threads.length - 1; k >= 1; i = k += -1) {
      t = this.threads[i];
      if (t.terminated) {
        this.threads.splice(i, 1);
        index = this.system.threads.indexOf(t.interface);
        if (index >= 0) {
          this.system.threads.splice(index, 1);
        }
      }
    }
    t = Date.now() - time;
    dt = time_limit - time;
    load = t / dt * 100;
    this.cpu_load = this.cpu_load * .9 + load * .1;
    this.system.cpu_load = Math.min(100, Math.round(this.cpu_load));
  }

  createThread(routine, delay, repeat) {
    var i, j, ref, t;
    t = new Thread(this);
    t.routine = routine;
    this.threads.push(t);
    t.start_time = Date.now() + delay - 1000 / this.fps;
    if (repeat) {
      t.repeat = repeat;
      t.delay = delay;
    }
    this.system.threads.push(t.interface);
    for (i = j = 0, ref = routine.import_values.length - 1; j <= ref; i = j += 1) {
      if (routine.import_values[i] === routine) {
        routine.import_values[i] = t.interface;
      }
    }
    return t.interface;
  }

  sleep(value) {
    if (this.current_thread != null) {
      return this.current_thread.sleep_until = Date.now() + Math.max(0, value);
    }
  }

};

this.Thread = class Thread {
  constructor(runner) {
    this.runner = runner;
    this.loop = false;
    this.processor = new Processor(this.runner);
    this.paused = false;
    this.terminated = false;
    this.next_calls = [];
    this.interface = {
      pause: () => {
        return this.pause();
      },
      resume: () => {
        return this.resume();
      },
      stop: () => {
        return this.stop();
      },
      status: "running"
    };
  }

  addCall(call) {
    if (this.next_calls.indexOf(call) < 0) {
      return this.next_calls.push(call);
    }
  }

  loadNext() {
    var compiler, f, parser, program;
    if (this.next_calls.length > 0) {
      f = this.next_calls.splice(0, 1)[0];
      if (f instanceof Routine) {
        this.processor.load(f);
      } else {
        parser = new Parser(f, "");
        parser.parse();
        program = parser.program;
        compiler = new Compiler(program);
        this.processor.load(compiler.routine);
        if ((f === "update()" || f === "serverUpdate()") && (this.runner.updateControls != null)) {
          this.runner.updateControls();
        }
      }
      return true;
    } else {
      return false;
    }
  }

  pause() {
    if (this.interface.status === "running") {
      this.interface.status = "paused";
      this.paused = true;
      return 1;
    } else {
      return 0;
    }
  }

  resume() {
    if (this.interface.status === "paused") {
      this.interface.status = "running";
      this.paused = false;
      return 1;
    } else {
      return 0;
    }
  }

  stop() {
    this.interface.status = "stopped";
    this.terminated = true;
    return 1;
  }

};

this.MicroScriptRunner = this.Runner = MicroScriptRunner;
if (typeof window !== "undefined") {
  window.MicroScriptRunner = MicroScriptRunner;
}

var LANGUAGE_MICROSCRIPT, LANGUAGE_MICROSCRIPT2;

LANGUAGE_MICROSCRIPT = {
  ace_mode: "ace/mode/microscript",
  parser: Parser
};

LANGUAGE_MICROSCRIPT2 = {
  ace_mode: "ace/mode/microscript2",
  parser: Parser
};

var LANGUAGE_JAVASCRIPT;

LANGUAGE_JAVASCRIPT = {
  ace_mode: "ace/mode/javascript"
};

class JavaScriptRunner {
  constructor(microvm) {
    this.microvm = microvm;
  }

  init() {
    var kd, key, src;
    this.initialized = true;
    window.ctx = this.microvm.context.global;
    window.ctx.print = (text) => {
      return this.microvm.context.meta.print(text);
    };
    src = "";
    for (key in this.microvm.context.global) {
      kd = key;
      if (key === "Image") {
        kd = "msImage";
      }
      if (key === "Map") {
        kd = "msMap";
      }
      src += `${kd} =  window.ctx.${key};\n`;
    }
    return this.run(src);
  }

  run(program, name = "") {
    var err, file, line;
    if (!this.initialized) {
      this.init();
    }
    program += `\n//# sourceURL=${name}.js`;
    try {
      return window.eval(program);
    } catch (error) {
      err = error;
      if (err.stack != null) {
        line = err.stack.split(".js:");
        file = line[0];
        line = line[1];
        if ((file != null) && (line != null)) {
          line = line.split(":")[0];
          if (file.lastIndexOf("(") >= 0) {
            file = file.substring(file.lastIndexOf("(") + 1);
          }
          if (file.lastIndexOf("@") >= 0) {
            file = file.substring(file.lastIndexOf("@") + 1);
          }
          this.microvm.context.location = {
            token: {
              line: line,
              column: 0
            }
          };
        }
      }
      throw err.message;
    }
  }

  call(name, args) {
    var err, file, line;
    try {
      if (window[name] != null) {
        return window[name].apply(this.microvm.context.global, args);
      }
    } catch (error) {
      err = error;
      if (err.stack != null) {
        line = err.stack.split(".js:");
        file = line[0];
        line = line[1];
        if ((file != null) && (line != null)) {
          line = line.split(":")[0];
          if (file.lastIndexOf("(") >= 0) {
            file = file.substring(file.lastIndexOf("(") + 1);
          }
          if (file.lastIndexOf("@") >= 0) {
            file = file.substring(file.lastIndexOf("@") + 1);
          }
          this.microvm.context.location = {
            token: {
              line: line,
              file: file,
              column: 0
            }
          };
        }
      }
      throw err.message;
    }
  }

  toString(obj) {
    if (obj != null) {
      return obj.toString();
    } else {
      return "null";
    }
  }

};

this.JavaScriptRunner = JavaScriptRunner;
if (typeof window !== "undefined") {
  window.JavaScriptRunner = JavaScriptRunner;
}

var LANGUAGE_PYTHON;

LANGUAGE_PYTHON = {
  ace_mode: "ace/mode/python"
};

class PythonRunner {
  constructor(microvm) {
    this.microvm = microvm;
  }

  init() {
    var kd, key, src;
    this.initialized = true;
    window.ctx = this.microvm.context.global;
    src = "";
    for (key in this.microvm.context.global) {
      kd = key;
      src += `${kd} =  window.ctx.${key}\n`;
    }
    window.stdout = {
      write: (text) => {
        return this.microvm.context.meta.print(text);
      }
    };
    window.stderr = {
      write: (text) => {
        var f, file, i, len, line, t;
        if (Array.isArray(text)) {
          line = 1;
          file = "";
          for (i = 0, len = text.length; i < len; i++) {
            t = text[i];
            f = t.split("File");
            if (f[1] != null) {
              f = f[1].split('"');
              if ((f[1] != null) && f[1].length > 0) {
                file = f[1];
              }
            }
            t = t.split(" line ");
            if (t[1] != null) {
              line = t[1].split("\n")[0].split(",")[0];
            }
          }
          this.microvm.context.location = {
            token: {
              file: file,
              line: line,
              column: 0,
              error_text: text[text.length - 1].replace("\n", "")
            }
          };
          throw text[text.length - 1].replace("\n", "");
        } else {
          throw text;
        }
      }
    };
    src += "import sys\n\nsys.stdout = window.stdout\n\nsys.stderr = window.stderr\n\n";
    return this.run(src);
  }

  run(program, name = "") {
    var err, res;
    if (!this.initialized) {
      this.init();
    }
    try {
      res = python(program, name);
      program = "import traceback\nimport sys\n\ndef __draw():\n  try:\n    draw()\n  except BaseException as err:\n    sys.stderr.write(traceback.format_exception(err))\n\n  except Error as err:\n    sys.stderr.write(traceback.format_exception(err))\n\ndef __update():\n  try:\n    update()\n  except BaseException as err:\n    sys.stderr.write(traceback.format_exception(err))\n\n  except Error as err:\n    sys.stderr.write(traceback.format_exception(err))\n\ndef __init():\n  try:\n    init()\n  except BaseException as err:\n    sys.stderr.write(traceback.format_exception(err))\n\n  except Error as err:\n    sys.stderr.write(traceback.format_exception(err))\n\ndef __serverInit():\n  try:\n    serverInit()\n  except BaseException as err:\n    sys.stderr.write(traceback.format_exception(err))\n\n  except Error as err:\n    sys.stderr.write(traceback.format_exception(err))\n\ndef __serverUpdate():\n  try:\n    serverUpdate()\n  except BaseException as err:\n    sys.stderr.write(traceback.format_exception(err))\n\n  except Error as err:\n    sys.stderr.write(traceback.format_exception(err))\n\nif \"draw\" in globals():\n  window.draw = __draw\n\nif \"update\" in globals():\n  window.update = __update\n\nif \"init\" in globals():\n  window.init = __init\n\nif \"serverInit\" in globals():\n  window.serverInit = __serverInit\n\nif \"serverUpdate\" in globals():\n  window.serverUpdate = __serverUpdate\n";
      python(program, "__init__");
      return res;
    } catch (error) {
      err = error;
      throw err.toString();
    }
  }

  call(name, args) {
    var err;
    if ((name === "draw" || name === "update" || name === "init" || name === "serverInit" || name === "serverUpdate") && typeof window[name] === "function") {
      try {
        return window[name]();
      } catch (error) {
        err = error;
        throw err.toString();
      }
    } else {

    }
  }

  toString(obj) {
    if (obj != null) {
      return obj.toString();
    } else {
      return "none";
    }
  }

};

this.PythonRunner = PythonRunner;
if (typeof window !== "undefined") {
  window.PythonRunner = PythonRunner;
}

var LANGUAGE_LUA;

LANGUAGE_LUA = {
  ace_mode: "ace/mode/lua"
};

var LuaRunner = (function() {
  function LuaRunner(microvm) {
    this.microvm = microvm;
  }

  LuaRunner.prototype.init = function() {
    var kd, key, src;
    this.initialized = true;
    window.ctx = this.microvm.context.global;
    window.ctx.print = (function(_this) {
      return function(text) {
        return _this.microvm.context.meta.print(text);
      };
    })(this);
    src = "js = require 'js'";
    for (key in this.microvm.context.global) {
      kd = key;
      src += kd + " =  js.global.ctx." + key + "\n";
    }
    src += "print = function(text) js.global.ctx:print(text) end\n";
    src += "new = js.new\n";
    return this.run(src);
  };

  LuaRunner.prototype.run = function(program, name) {
    var err, line, res;
    if (name == null) {
      name = "";
    }
    if (!this.initialized) {
      this.init();
    }
    try {
      res = fengari.load(program, name)();
    } catch (error) {
      err = error;
      line = err.toString().split("]:")[1];
      if (line != null) {
        line = line.split(":")[0] || 1;
      } else {
        line = 0;
      }
      this.microvm.context.location = {
        token: {
          line: line,
          column: 0
        }
      };
      throw err.toString();
    }
    return res;
  };

  LuaRunner.prototype.call = function(name, args) {
    var err, file, line, res;
    try {
      res = fengari.load("if " + name + " then " + name + "() end")();
      return res;
    } catch (error) {
      err = error;
      line = err.toString().split("]:")[1];
      if (line != null) {
        line = line.split(":")[0] || 1;
      } else {
        line = 0;
      }
      file = err.toString().split('"')[1] || "";
      this.microvm.context.location = {
        token: {
          line: line,
          column: 0,
          file: file
        }
      };
      throw err.toString();
    }
  };

  LuaRunner.prototype.toString = function(obj) {
    if (obj != null) {
      return obj.toString();
    } else {
      return "nil";
    }
  };

  return LuaRunner;

})();

this.LuaRunner = LuaRunner;
if (typeof window !== "undefined") {
  window.LuaRunner = LuaRunner;
}

this.MPServerConnection = class MPServerConnection {
  constructor(address) {
    var impl;
    this.status = "connecting";
    impl = new MPServerConnectionImpl(this, address);
    this.send = (data) => {
      var err;
      try {
        impl.sendMessage(data);
        return "sent";
      } catch (error) {
        err = error;
        console.error(err);
        return err.toString();
      }
    };
    this.close = () => {
      var err;
      try {
        return impl.close();
      } catch (error) {
        err = error;
        return console.error(err);
      }
    };
    this.messages = [];
  }

};

this.MPServerConnectionImpl = class MPServerConnectionImpl {
  constructor(_interface, address1) {
    var err;
    this.interface = _interface;
    this.address = address1;
    this.status = "connecting";
    this.buffer = [];
    if (this.address) {
      this.connect(this.address);
    } else {
      try {
        this.getRelay((address) => {
          return this.connect(address);
        });
      } catch (error) {
        err = error;
        console.error(err);
      }
    }
    this.messages = [];
    player.runtime.addConnection(this);
  }

  getRelay(callback) {
    return player.client.sendRequest({
      name: "get_relay_server"
    }, (msg) => {
      var address;
      if (msg.name === "error") {
        this.interface.status = "error";
        return this.interface.error = msg.error;
      } else {
        address = msg.address;
        if (address === "self") {
          address = location.origin.replace("http", "ws");
        }
        return callback(address);
      }
    });
  }

  connect(address) {
    this.socket = new WebSocket(address);
    this.socket.onmessage = (msg) => {
      var err;
      try {
        msg = JSON.parse(msg.data);
        switch (msg.name) {
          case "mp_server_message":
            return this.messages.push(msg.data);
        }
      } catch (error) {
        err = error;
        return console.error(err);
      }
    };
    this.socket.onopen = () => {
      var i, len, m, ref;
      this.interface.status = "connected";
      this.send({
        name: "mp_client_connection",
        server_id: ms_project_id
      });
      ref = this.buffer;
      for (i = 0, len = ref.length; i < len; i++) {
        m = ref[i];
        this.sendMessage(m);
      }
      return this.buffer = [];
    };
    return this.socket.onclose = () => {
      return this.interface.status = "disconnected";
    };
  }

  update() {
    if (this.messages.length > 0 || this.interface.messages.length > 0) {
      this.interface.messages = this.messages;
      return this.messages = [];
    }
  }

  sendMessage(data) {
    if ((this.socket != null) && this.socket.readyState === 1) {
      return this.send({
        name: "mp_client_message",
        data: data
      });
    } else {
      return this.buffer.push(data);
    }
  }

  send(data) {
    return this.socket.send(JSON.stringify(data));
  }

  close() {
    return this.socket.close();
  }

};

this.MicroVM = class MicroVM {
  constructor(meta = {}, global = {}, namespace1 = "/microstudio", preserve_ls = false) {
    var ctx, err;
    this.namespace = namespace1;
    this.preserve_ls = preserve_ls;
    if (meta.print == null) {
      meta.print = (text) => {
        if (typeof text === "object" && (this.runner != null)) {
          text = this.runner.toString(text);
        }
        return console.info(text);
      };
    }
    Array.prototype.insert = function(e) {
      this.splice(0, 0, e);
      return e;
    };
    Array.prototype.insertAt = function(e, i) {
      if (i >= 0 && i < this.length) {
        this.splice(i, 0, e);
      } else {
        this.push(e);
      }
      return e;
    };
    Array.prototype.remove = function(i) {
      if (i >= 0 && i < this.length) {
        return this.splice(i, 1)[0];
      } else {
        return 0;
      }
    };
    Array.prototype.removeAt = function(i) {
      if (i >= 0 && i < this.length) {
        return this.splice(i, 1)[0];
      } else {
        return 0;
      }
    };
    Array.prototype.removeElement = function(e) {
      var index;
      index = this.indexOf(e);
      if (index >= 0) {
        return this.splice(index, 1)[0];
      } else {
        return 0;
      }
    };
    Array.prototype.contains = function(e) {
      if (this.indexOf(e) >= 0) {
        return 1;
      } else {
        return 0;
      }
    };
    meta.round = function(x) {
      return Math.round(x);
    };
    meta.floor = function(x) {
      return Math.floor(x);
    };
    meta.ceil = function(x) {
      return Math.ceil(x);
    };
    meta.abs = function(x) {
      return Math.abs(x);
    };
    meta.min = function(x, y) {
      return Math.min(x, y);
    };
    meta.max = function(x, y) {
      return Math.max(x, y);
    };
    meta.sqrt = function(x) {
      return Math.sqrt(x);
    };
    meta.pow = function(x, y) {
      return Math.pow(x, y);
    };
    meta.sin = function(x) {
      return Math.sin(x);
    };
    meta.cos = function(x) {
      return Math.cos(x);
    };
    meta.tan = function(x) {
      return Math.tan(x);
    };
    meta.acos = function(x) {
      return Math.acos(x);
    };
    meta.asin = function(x) {
      return Math.asin(x);
    };
    meta.atan = function(x) {
      return Math.atan(x);
    };
    meta.atan2 = function(y, x) {
      return Math.atan2(y, x);
    };
    meta.sind = function(x) {
      return Math.sin(x / 180 * Math.PI);
    };
    meta.cosd = function(x) {
      return Math.cos(x / 180 * Math.PI);
    };
    meta.tand = function(x) {
      return Math.tan(x / 180 * Math.PI);
    };
    meta.acosd = function(x) {
      return Math.acos(x) * 180 / Math.PI;
    };
    meta.asind = function(x) {
      return Math.asin(x) * 180 / Math.PI;
    };
    meta.atand = function(x) {
      return Math.atan(x) * 180 / Math.PI;
    };
    meta.atan2d = function(y, x) {
      return Math.atan2(y, x) * 180 / Math.PI;
    };
    meta.log = function(x) {
      return Math.log(x);
    };
    meta.exp = function(x) {
      return Math.exp(x);
    };
    meta.random = new Random(0);
    meta.PI = Math.PI;
    meta.true = 1;
    meta.false = 0;
    global.system = {
      time: Date.now,
      language: navigator.language,
      update_rate: 60,
      inputs: {
        keyboard: 1,
        mouse: 1,
        touch: "ontouchstart" in window ? 1 : 0,
        gamepad: 0
      },
      prompt: (text, callback) => {
        return setTimeout((() => {
          var args, result;
          global.mouse.pressed = 0;
          global.touch.touching = 0;
          result = window.prompt(text);
          if ((callback != null) && typeof callback === "function") {
            args = [(result != null ? 1 : 0), result];
            this.context.timeout = Date.now() + 1000;
            return callback.apply(null, args);
          }
        }), 0);
      },
      say: (text) => {
        return setTimeout((() => {
          return window.alert(text);
        }), 0);
      }
    };
    try {
      global.system.inputs.keyboard = window.matchMedia("(pointer:fine)").matches ? 1 : 0;
      global.system.inputs.mouse = window.matchMedia("(any-hover:none)").matches ? 0 : 1;
    } catch (error1) {
      err = error1;
    }
    this.storage_service = this.createStorageService();
    global.storage = this.storage_service.api;
    meta.global = global;
    this.context = {
      meta: meta,
      global: global,
      local: global,
      object: global,
      breakable: 0,
      continuable: 0,
      returnable: 0,
      stack_size: 0
    };
    ctx = this.context;
    Array.prototype.sortList = function(f) {
      var funk;
      if ((f != null) && f instanceof Program.Function) {
        funk = function(a, b) {
          return f.call(ctx, [a, b], true);
        };
      } else if ((f != null) && typeof f === "function") {
        funk = f;
      }
      return this.sort(funk);
    };
    this.clearWarnings();
    const lang = (window.language || (window.resources && window.resources.language) || "microscript").toLowerCase();
    if (lang === "javascript" || lang === "js") {
      const RunnerClass = (typeof JavaScriptRunner !== "undefined") ? JavaScriptRunner : (window.JavaScriptRunner || this.JavaScriptRunner);
      this.runner = new RunnerClass(this);
    } else if (lang === "python" || lang === "py") {
      const RunnerClass = (typeof PythonRunner !== "undefined") ? PythonRunner : (window.PythonRunner || this.PythonRunner);
      this.runner = new RunnerClass(this);
    } else if (lang === "lua") {
      const RunnerClass = (typeof LuaRunner !== "undefined") ? LuaRunner : (window.LuaRunner || this.LuaRunner);
      this.runner = new RunnerClass(this);
    } else {
      const RunnerClass = (typeof MicroScriptRunner !== "undefined") ? MicroScriptRunner : (window.MicroScriptRunner || this.MicroScriptRunner);
      this.runner = new RunnerClass(this);
    }
  }

  clearWarnings() {
    return this.context.warnings = {
      using_undefined_variable: {},
      assigning_field_to_undefined: {},
      invoking_non_function: {},
      assigning_api_variable: {},
      assignment_as_condition: {}
    };
  }

  setMeta(key, value) {
    return this.context.meta[key] = value;
  }

  setGlobal(key, value) {
    return this.context.global[key] = value;
  }

  run(program, timeout = 3000, filename = "", callback) {
    var err, res;
    this.program = program;
    this.error_info = null;
    this.context.timeout = Date.now() + timeout;
    this.context.stack_size = 0;
    try {
      res = this.runner.run(this.program, filename, callback);
      this.storage_service.check();
      if (res != null) {
        return this.runner.toString(res);
      } else {
        return null;
      }
    } catch (error1) {
      err = error1;
      if ((err.type != null) && (err.line != null) && (err.error != null)) {
        this.error_info = err;
      } else if ((this.context.location != null) && (this.context.location.token != null)) {
        this.error_info = {
          error: this.context.location.token.error_text || err,
          file: filename,
          line: this.context.location.token.line,
          column: this.context.location.token.column
        };
        console.info(`Error at line: ${this.context.location.token.line} column: ${this.context.location.token.column}`);
      } else {
        this.error_info = {
          error: err,
          file: filename
        };
      }
      console.error(err);
      return this.storage_service.check();
    }
  }

  call(name, args = [], timeout = 3000) {
    var err, res;
    this.error_info = null;
    this.context.timeout = Date.now() + timeout;
    this.context.stack_size = 0;
    try {
      res = this.runner.call(name, args);
      this.storage_service.check();
      return res;
    } catch (error1) {
      err = error1;
      console.error(err);
      if ((this.context.location != null) && (this.context.location.token != null)) {
        this.error_info = {
          error: this.context.location.token.error_text || err,
          line: this.context.location.token.line,
          column: this.context.location.token.column,
          file: this.context.location.token.file
        };
      } else {
        this.error_info = {
          error: err
        };
      }
      if ((this.context.location != null) && (this.context.location.token != null)) {
        console.info(`Error at line: ${this.context.location.token.line} column: ${this.context.location.token.column}`);
      }
      return this.storage_service.check();
    }
  }

  createStorageService() {
    var err, error, ls, namespace, s, service, storage, write_storage;
    try {
      ls = window.localStorage;
    } catch (error1) {
      error = error1; // in incognito mode, embedded by an iframe, localStorage isn't available
      console.info("localStorage not available");
      return service = {
        api: {
          set: function() {},
          get: function() {
            return 0;
          }
        },
        check: function() {}
      };
    }
    if (!this.preserve_ls) {
      try {
        delete window.localStorage;
      } catch (error1) {
        err = error1;
      }
    }
    storage = {};
    write_storage = false;
    namespace = this.namespace;
    try {
      s = ls.getItem(`ms${namespace}`);
      if (s) {
        storage = JSON.parse(s);
      }
    } catch (error1) {
      err = error1;
    }
    return service = {
      api: {
        set: (name, value) => {
          value = this.storableObject(value);
          if ((name != null) && (value != null)) {
            storage[name] = value;
            write_storage = true;
          }
          return value;
        },
        get: (name) => {
          if (name != null) {
            if (storage[name] != null) {
              return storage[name];
            } else {
              return 0;
            }
          } else {
            return 0;
          }
        }
      },
      check: () => {
        if (write_storage) {
          write_storage = false;
          try {
            return ls.setItem(`ms${namespace}`, JSON.stringify(storage));
          } catch (error1) {
            err = error1;
          }
        }
      }
    };
  }

  storableObject(value) {
    var referenced;
    referenced = [this.context.global.screen, this.context.global.system, this.context.global.keyboard, this.context.global.audio, this.context.global.gamepad, this.context.global.touch, this.context.global.mouse, this.context.global.sprites, this.context.global.maps];
    return this.makeStorableObject(value, referenced);
  }

  makeStorableObject(value, referenced) {
    var i, j, key, len, res, v;
    if (value == null) {
      return value;
    }
    if (typeof value === "function" || ((typeof Program !== "undefined" && Program !== null) && value instanceof Program.Function) || ((typeof Routine !== "undefined" && Routine !== null) && value instanceof Routine)) {
      return void 0;
    } else if (typeof value === "object") {
      if (referenced.indexOf(value) >= 0) {
        return void 0;
      }
      referenced = referenced.slice();
      referenced.push(value);
      if (Array.isArray(value)) {
        res = [];
        for (i = j = 0, len = value.length; j < len; i = ++j) {
          v = value[i];
          v = this.makeStorableObject(v, referenced);
          if (v != null) {
            res[i] = v;
          }
        }
        return res;
      } else {
        res = {};
        for (key in value) {
          v = value[key];
          if (key === "class") {
            continue;
          }
          v = this.makeStorableObject(v, referenced);
          if (v != null) {
            res[key] = v;
          }
        }
        return res;
      }
    } else {
      return value;
    }
  }

};

var arrayBufferToBase64, loadFile, loadLameJSLib, loadWaveFileLib, saveFile, writeProjectFile;

this.Runtime = class Runtime {
  constructor(url1, sources, resources, listener) {
    this.url = url1;
    this.sources = sources;
    this.resources = resources;
    this.listener = listener;
    this.screen = new Screen(this);
    this.audio = new AudioCore(this);
    this.keyboard = new Keyboard();
    this.gamepad = new Gamepad();
    this.asset_manager = new AssetManager(this);
    this.sprites = {};
    this.maps = {};
    this.sounds = {};
    this.music = {};
    this.assets = {};
    this.touch = {};
    this.mouse = this.screen.mouse;
    this.previous_init = null;
    this.random = new Random(0);
    this.orientation = (this.resources && this.resources.orientation) || (window.resources && window.resources.orientation) || "landscape";
    this.aspect = (this.resources && this.resources.aspect) || (window.resources && window.resources.aspect) || "16:9";
    this.report_errors = true;
    this.log = (text) => {
      return this.listener.log(text);
    };
    this.update_memory = {};
    this.time_machine = new TimeMachine(this);
    this.createDropFeature();
    window.ms_async_load = false;
    this.connections = [];
  }

  addConnection(connection) {
    return this.connections.push(connection);
  }

  updateSource(file, src, reinit = false) {
    var err, init;
    if (this.vm == null) {
      return false;
    }
    if (src === this.update_memory[file]) {
      return false;
    }
    this.update_memory[file] = src;
    this.audio.cancelBeeps();
    this.screen.clear();
    try {
      this.vm.run(src, 3000, file);
      this.listener.postMessage({
        name: "compile_success",
        file: file
      });
      this.reportWarnings();
      if (this.vm.error_info != null) {
        err = this.vm.error_info;
        err.type = "init";
        err.file = file;
        this.listener.reportError(err);
        return false;
      }
      if (this.vm.runner.getFunctionSource != null) {
        init = this.vm.runner.getFunctionSource("init");
        if ((init != null) && init !== this.previous_init && reinit) {
          this.previous_init = init;
          this.vm.call("init");
          if (this.vm.error_info != null) {
            err = this.vm.error_info;
            err.type = "init";
            this.listener.reportError(err);
          }
        }
      }
      return true;
    } catch (error) {
      err = error;
      if (this.report_errors) {
        console.error(err);
        err.file = file;
        this.listener.reportError(err);
        return false;
      }
    }
  }

  start() {
    var a, i, j, k, key, l, len1, len2, len3, len4, len5, m, n, name, o, ref, ref1, ref2, ref3, ref4, ref5, s, value;
    if (window.ms_async_load) {
      this.startReady();
    }
    ref = this.resources.images;
    for (j = 0, len1 = ref.length; j < len1; j++) {
      i = ref[j];
      const spriteUrl = i.url || (this.url + "sprites/" + i.file + "?v=" + i.version);
      s = LoadSprite(spriteUrl, i.properties, () => {
        this.updateMaps();
        return this.checkStartReady();
      });
      name = i.file.split(".")[0].replace(/-/g, "/");
      s.name = name;
      this.sprites[name] = s;
    }
    if (Array.isArray(this.resources.maps)) {
      ref1 = this.resources.maps;
      for (k = 0, len2 = ref1.length; k < len2; k++) {
        m = ref1[k];
        name = m.file.split(".")[0].replace(/-/g, "/");
        const mapUrl = m.url || (this.url + `maps/${m.file}?v=${m.version}`);
        this.maps[name] = LoadMap(mapUrl, () => {
          return this.checkStartReady();
        }, m.data);
        this.maps[name].name = name;
      }
    } else if (this.resources.maps != null) {
      if (window.player == null) {
        window.player = this.listener;
      }
      ref2 = this.resources.maps;
      for (key in ref2) {
        value = ref2[key];
        this.updateMap(key, 0, value);
      }
    }
    ref3 = this.resources.sounds;
    for (l = 0, len3 = ref3.length; l < len3; l++) {
      s = ref3[l];
      name = s.file.split(".")[0];
      const soundUrl = s.url || (this.url + "sounds/" + s.file + "?v=" + s.version);
      s = new Sound(this.audio, soundUrl);
      s.name = name;
      this.sounds[name] = s;
    }
    ref4 = this.resources.music;
    for (n = 0, len4 = ref4.length; n < len4; n++) {
      m = ref4[n];
      name = m.file.split(".")[0];
      const musicUrl = m.url || (this.url + "music/" + m.file + "?v=" + m.version);
      m = new Music(this.audio, musicUrl);
      m.name = name;
      this.music[name] = m;
    }
    ref5 = this.resources.assets;
    for (o = 0, len5 = ref5.length; o < len5; o++) {
      a = ref5[o];
      name = a.file.split(".")[0];
      name = name.replace(/-/g, "/");
      a.name = name;
      this.assets[name] = a;
    }
    this.checkStartReady();
  }

  checkStartReady() {
    var count, key, progress, ready, ref, ref1, value;
    count = 0;
    ready = 0;
    ref = this.sprites;
    for (key in ref) {
      value = ref[key];
      count += 1;
      if (value.ready) {
        ready += 1;
      }
    }
    ref1 = this.maps;
    for (key in ref1) {
      value = ref1[key];
      count += 1;
      if (value.ready) {
        ready += 1;
      }
    }
    if (ready < count) {
      if ((this.loading_bar_time == null) || Date.now() > this.loading_bar_time + 16) {
        this.loading_bar_time = Date.now();
        if (this.screen.fillRect != null) {
          this.screen.clear();
          this.screen.drawRect(0, 0, 100, 10, "#DDD");
          progress = ready / count;
          this.screen.fillRect(-(1 - progress) * 48, 0, progress * 96, 6, "#DDD");
        }
        if (window.ms_async_load && (this.vm != null)) {
          this.vm.context.global.system.loading = Math.floor(ready / count * 100);
        }
      }
      if (!window.ms_async_load) {
        return;
      }
    } else {
      if (window.ms_async_load && (this.vm != null)) {
        this.vm.context.global.system.loading = 100;
      }
    }
    if (!this.started) {
      return this.startReady();
    }
  }

  startReady() {
    var err, file, global, init, j, len1, lib, meta, namespace, ref, ref1, src;
    this.started = true;
    meta = {
      print: (text) => {
        if ((typeof text === "object" || typeof text === "function") && (this.vm != null)) {
          text = this.vm.runner.toString(text);
        }
        return this.listener.log(text);
      }
    };
    global = {
      screen: this.screen.getInterface(),
      audio: this.audio.getInterface(),
      keyboard: this.keyboard.keyboard,
      gamepad: this.gamepad.status,
      sprites: this.sprites,
      sounds: this.sounds,
      music: this.music,
      assets: this.assets,
      asset_manager: this.asset_manager.getInterface(),
      maps: this.maps,
      touch: this.touch,
      mouse: this.mouse,
      fonts: window.fonts,
      Sound: Sound.createSoundClass(this.audio),
      Image: msImage,
      Sprite: Sprite,
      Map: MicroMap
    };
    if (window.graphics === "M3D" && typeof M3D !== "undefined") {
      global.M3D = M3D;
      M3D.runtime = this;
    } else if (window.graphics === "M2D" && typeof M2D !== "undefined") {
      global.M2D = M2D;
      M2D.runtime = this;
    } else if (window.graphics && typeof window.graphics === "string" && window.graphics.toLowerCase().startsWith("pixi") && typeof PIXI !== "undefined") {
      global.PIXI = PIXI;
      PIXI.runtime = this;
    } else if (window.graphics && typeof window.graphics === "string" && window.graphics.toLowerCase().startsWith("babylon") && typeof BABYLON !== "undefined") {
      global.BABYLON = BABYLON;
      BABYLON.runtime = this;
    }
    if (window.ms_libs && Array.isArray(window.ms_libs)) {
      ref = window.ms_libs;
      for (j = 0, len1 = ref.length; j < len1; j++) {
        lib = ref[j];
        lib = lib.split("_")[0];
        switch (lib) {
          case "matterjs":
          case "matter":
            if (typeof Matter !== "undefined") global.Matter = Matter;
            break;
          case "cannonjs":
          case "cannon":
            if (typeof CANNON !== "undefined") global.CANNON = CANNON;
            break;
        }
      }
    }
    namespace = location.pathname;
    this.vm = new MicroVM(meta, global, namespace, location.hash === "#transpiler");
    if (window.ms_use_server) {
      this.vm.context.global.ServerConnection = MPServerConnection;
    }
    this.vm.context.global.system.pause = () => {
      return this.listener.codePaused();
    };
    this.vm.context.global.system.exit = () => {
      return this.exit();
    };
    if (!window.ms_async_load) {
      this.vm.context.global.system.loading = 100;
    }
    this.vm.context.global.system.disable_autofullscreen = 0;
    this.vm.context.global.system.file = System.file;
    this.vm.context.global.system.javascript = System.javascript;
    if (window.ms_in_editor) {
      this.vm.context.global.system.project = new ProjectInterface(this).interface;
    }
    System.runtime = this;
    ref1 = this.sources;
    for (file in ref1) {
      src = ref1[file];
      this.updateSource(file, src, false);
    }
    if (this.vm.runner.getFunctionSource != null) {
      init = this.vm.runner.getFunctionSource("init");
      if (init != null) {
        this.previous_init = init;
        this.vm.call("init");
        if (this.vm.error_info != null) {
          err = this.vm.error_info;
          err.type = "draw";
          this.listener.reportError(err);
        }
      }
    } else {
      this.vm.call("init");
      if (this.vm.error_info != null) {
        err = this.vm.error_info;
        err.type = "draw";
        this.listener.reportError(err);
      }
    }
    this.dt = 1000 / 60;
    this.last_time = Date.now();
    this.current_frame = 0;
    this.floating_frame = 0;
    requestAnimationFrame(() => {
      return this.timer();
    });
    this.screen.startControl();
    return this.listener.postMessage({
      name: "started"
    });
  }

  updateMaps() {
    var key, map, ref;
    ref = this.maps;
    for (key in ref) {
      map = ref[key];
      map.needs_update = true;
    }
  }

  runCommand(command, callback) {
    var err, res, warnings;
    try {
      warnings = this.vm.context.warnings;
      this.vm.clearWarnings();
      res = this.vm.run(command, void 0, void 0, callback);
      this.reportWarnings();
      this.vm.context.warnings = warnings;
      if (this.vm.error_info != null) {
        err = this.vm.error_info;
        err.type = "exec";
        this.listener.reportError(err);
      }
      this.watchStep();
      if (callback == null) {
        return res;
      } else if (res != null) {
        callback(res);
      }
      return null;
    } catch (error) {
      err = error;
      return this.listener.reportError(err);
    }
  }

  projectFileUpdated(type, file, version, data, properties) {
    switch (type) {
      case "sprites":
        return this.updateSprite(file, version, data, properties);
      case "maps":
        return this.updateMap(file, version, data);
      case "ms":
        return this.updateCode(file, version, data);
    }
  }

  projectFileDeleted(type, file) {
    switch (type) {
      case "sprites":
        return delete this.sprites[file.substring(0, file.length - 4).replace(/-/g, "/")];
      case "maps":
        return delete this.maps[file.substring(0, file.length - 5).replace(/-/g, "/")];
    }
  }

  projectOptionsUpdated(msg) {
    this.orientation = msg.orientation;
    this.aspect = msg.aspect;
    return this.screen.resize();
  }

  updateSprite(name, version, data, properties) {
    var img, slug;
    slug = name;
    name = name.replace(/-/g, "/");
    if (data != null) {
      data = "data:image/png;base64," + data;
      if (this.sprites[name] != null) {
        img = new Image;
        img.crossOrigin = "Anonymous";
        img.src = data;
        return img.onload = () => {
          UpdateSprite(this.sprites[name], img, properties);
          return this.updateMaps();
        };
      } else {
        this.sprites[name] = LoadSprite(data, properties, () => {
          return this.updateMaps();
        });
        return this.sprites[name].name = name;
      }
    } else {
      if (this.sprites[name] != null) {
        img = new Image;
        img.crossOrigin = "Anonymous";
        img.src = this.url + "sprites/" + slug + `.png?v=${version}`;
        return img.onload = () => {
          UpdateSprite(this.sprites[name], img, properties);
          return this.updateMaps();
        };
      } else {
        this.sprites[name] = LoadSprite(this.url + "sprites/" + slug + `.png?v=${version}`, properties, () => {
          return this.updateMaps();
        });
        return this.sprites[name].name = name;
      }
    }
  }

  updateMap(name, version, data) {
    var m, url;
    name = name.replace(/-/g, "/");
    if (data != null) {
      m = this.maps[name];
      if (m != null) {
        UpdateMap(m, data);
        return m.needs_update = true;
      } else {
        m = new MicroMap(1, 1, 1, 1);
        UpdateMap(m, data);
        this.maps[name] = m;
        return this.maps[name].name = name;
      }
    } else {
      url = this.url + `maps/${name}.json?v=${version}`;
      m = this.maps[name];
      if (m != null) {
        return m.loadFile(url);
      } else {
        this.maps[name] = LoadMap(url);
        return this.maps[name].name = name;
      }
    }
  }

  updateCode(name, version, data) {
    var req, url;
    if (data != null) {
      this.sources[name] = data;
      if ((this.vm != null) && data !== this.update_memory[name]) {
        this.vm.clearWarnings();
      }
      return this.updateSource(name, data, true);
    } else {
      url = this.url + `ms/${name}.ms?v=${version}`;
      req = new XMLHttpRequest();
      req.onreadystatechange = (event) => {
        if (req.readyState === XMLHttpRequest.DONE) {
          if (req.status === 200) {
            this.sources[name] = req.responseText;
            return this.updateSource(name, this.sources[name], true);
          }
        }
      };
      req.open("GET", url);
      return req.send();
    }
  }

  stop() {
    this.stopped = true;
    return this.audio.cancelBeeps();
  }

  stepForward() {
    if (this.stopped) {
      this.updateCall();
      this.drawCall();
      if (this.vm.runner.tick != null) {
        this.vm.runner.tick();
      }
      return this.watchStep();
    }
  }

  resume() {
    if (!this.started || !this.vm) {
      return;
    }
    if (this.stopped) {
      this.stopped = false;
      return requestAnimationFrame(() => {
        return this.timer();
      });
    }
  }

  timer() {
    var ds, dt, fps, i, j, ref, sync_update, time, update_rate;
    if (this.stopped || !this.vm) {
      return;
    }
    requestAnimationFrame(() => {
      return this.timer();
    });
    time = Date.now();
    if (Math.abs(time - this.last_time) > 160) {
      this.last_time = time - 16;
    }
    dt = time - this.last_time;
    this.dt = this.dt * .9 + dt * .1;
    this.last_time = time;
    this.vm.context.global.system.fps = Math.round(fps = 1000 / this.dt);
    update_rate = this.vm.context.global.system.update_rate;
    if ((update_rate == null) || !(update_rate > 0) || !isFinite(update_rate)) {
      update_rate = 60;
    }
    this.floating_frame += this.dt * update_rate / 1000;
    ds = Math.min(10, Math.round(this.floating_frame - this.current_frame));
    if ((ds === 0 || ds === 2) && update_rate === 60 && Math.abs(fps - 60) < 2) {
      //console.info "INCORRECT DS: "+ds+ " floating = "+@floating_frame+" current = "+@current_frame
      ds = 1;
      this.floating_frame = this.current_frame + 1;
    }
    sync_update = this.vm.context.global.system.sync_update;
    if (sync_update) {
      this.updateCall();
    } else {
      for (i = j = 1, ref = ds; j <= ref; i = j += 1) {
        this.updateCall();
        if (i < ds) {
          if (this.vm.runner.tick != null) {
            this.vm.runner.tick();
          }
        }
      }
    }
    this.current_frame += ds;
    this.drawCall();
    if (this.vm.runner.tick != null) {
      this.vm.runner.tick();
    }
    if (ds > 0) {
      return this.watchStep();
    }
  }

  //if ds != 1
  //  console.info "frame missed"
  //if @current_frame%60 == 0
  //  console.info("fps: #{Math.round(1000/@dt)}")
  updateCall() {
    var err;
    if (this.vm.runner.triggers_controls_update) {
      if (this.vm.runner.updateControls == null) {
        this.vm.runner.updateControls = () => {
          return this.updateControls();
        };
      }
    } else {
      this.updateControls();
    }
    try {
      //time = Date.now()
      this.vm.call("update");
      this.time_machine.step();
      this.reportWarnings();
      //console.info "update time: "+(Date.now()-time)
      if (this.vm.error_info != null) {
        err = this.vm.error_info;
        err.type = "update";
        return this.listener.reportError(err);
      }
    } catch (error) {
      err = error;
      if (this.report_errors) {
        return this.listener.reportError(err);
      }
    }
  }

  drawCall() {
    var err;
    try {
      this.screen.initDraw();
      this.screen.updateInterface();
      this.vm.call("draw");
      this.reportWarnings();
      if (this.vm.error_info != null) {
        err = this.vm.error_info;
        err.type = "draw";
        return this.listener.reportError(err);
      }
    } catch (error) {
      err = error;
      if (this.report_errors) {
        return this.listener.reportError(err);
      }
    }
  }

  reportWarnings() {
    var key, ref, ref1, ref2, ref3, ref4, value;
    if (this.vm != null) {
      ref = this.vm.context.warnings.invoking_non_function;
      for (key in ref) {
        value = ref[key];
        if (!value.reported) {
          value.reported = true;
          this.listener.reportError({
            error: "",
            type: "non_function",
            expression: value.expression,
            line: value.line,
            column: value.column,
            file: value.file
          });
        }
      }
      ref1 = this.vm.context.warnings.using_undefined_variable;
      for (key in ref1) {
        value = ref1[key];
        if (!value.reported) {
          value.reported = true;
          this.listener.reportError({
            error: "",
            type: "undefined_variable",
            expression: value.expression,
            line: value.line,
            column: value.column,
            file: value.file
          });
        }
      }
      ref2 = this.vm.context.warnings.assigning_field_to_undefined;
      for (key in ref2) {
        value = ref2[key];
        if (!value.reported) {
          value.reported = true;
          this.listener.reportError({
            error: "",
            type: "assigning_undefined",
            expression: value.expression,
            line: value.line,
            column: value.column,
            file: value.file
          });
        }
      }
      ref3 = this.vm.context.warnings.assigning_api_variable;
      for (key in ref3) {
        value = ref3[key];
        if (!value.reported) {
          value.reported = true;
          this.listener.reportError({
            error: "",
            type: "assigning_api_variable",
            expression: value.expression,
            line: value.line,
            column: value.column,
            file: value.file
          });
        }
      }
      ref4 = this.vm.context.warnings.assignment_as_condition;
      for (key in ref4) {
        value = ref4[key];
        if (!value.reported) {
          value.reported = true;
          this.listener.reportError({
            error: "",
            type: "assignment_as_condition",
            line: value.line,
            column: value.column,
            file: value.file
          });
        }
      }
    }
  }

  updateControls() {
    var c, err, j, k, key, len1, len2, ref, t, touches;
    ref = this.connections;
    for (j = 0, len1 = ref.length; j < len1; j++) {
      c = ref[j];
      c.update();
    }
    touches = Object.keys(this.screen.touches);
    this.touch.touching = touches.length > 0 ? 1 : 0;
    this.touch.touches = [];
    for (k = 0, len2 = touches.length; k < len2; k++) {
      key = touches[k];
      t = this.screen.touches[key];
      this.touch.x = t.x;
      this.touch.y = t.y;
      this.touch.touches.push({
        x: t.x,
        y: t.y,
        id: key
      });
    }
    if (this.mouse.pressed && !this.previous_mouse_pressed) {
      this.previous_mouse_pressed = true;
      this.mouse.press = 1;
    } else {
      this.mouse.press = 0;
    }
    if (!this.mouse.pressed && this.previous_mouse_pressed) {
      this.previous_mouse_pressed = false;
      this.mouse.release = 1;
    } else {
      this.mouse.release = 0;
    }
    this.mouse.wheel = this.screen.wheel || 0;
    this.screen.wheel = 0;
    if (this.touch.touching && !this.previous_touch) {
      this.previous_touch = true;
      this.touch.press = 1;
    } else {
      this.touch.press = 0;
    }
    if (!this.touch.touching && this.previous_touch) {
      this.previous_touch = false;
      this.touch.release = 1;
    } else {
      this.touch.release = 0;
    }
    this.vm.context.global.system.file.dropped = 0;
    if (this.files_dropped != null) {
      this.vm.context.global.system.file.dropped = this.files_dropped;
      delete this.files_dropped;
    }
    this.vm.context.global.system.file.loaded = 0;
    if (this.files_loaded != null) {
      this.vm.context.global.system.file.loaded = this.files_loaded;
      delete this.files_loaded;
    }
    this.gamepad.update();
    this.keyboard.update();
    try {
      this.vm.context.global.system.inputs.gamepad = this.gamepad.count > 0 ? 1 : 0;
    } catch (error) {
      err = error;
    }
  }

  getAssetURL(asset) {
    return this.url + "assets/" + asset + ".glb";
  }

  getWatcher() {
    return this.watcher || (this.watcher = new Watcher(this));
  }

  watch(variables) {
    return this.getWatcher().watch(variables);
  }

  watchStep() {
    return this.getWatcher().step();
  }

  stopWatching() {
    return this.getWatcher().stop();
  }

  exit() {
    var err;
    this.stop();
    if (this.screen.clear != null) {
      setTimeout((() => {
        return this.screen.clear();
      }), 1);
    }
    try {
      // microStudio embedded exit
      this.listener.exit();
    } catch (error) {
      err = error;
    }
    try {
      // TODO: Cordova exit, this might work
      if ((navigator.app != null) && (navigator.app.exitApp != null)) {
        navigator.app.exitApp();
      }
    } catch (error) {
      err = error;
    }
    try {
      // TODO: Electron exit, may already be covered by window.close()

      // Windowed mode exit
      return window.close();
    } catch (error) {
      err = error;
    }
  }

  createDropFeature() {
    document.addEventListener("dragenter", (event) => {
      return event.stopPropagation();
    });
    document.addEventListener("dragleave", (event) => {
      return event.stopPropagation();
    });
    document.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (player.runtime.screen.mouseMove != null) {
        return player.runtime.screen.mouseMove(event);
      }
    });
    return document.addEventListener("drop", (event) => {
      var err, file, files, i, index, j, len1, list, processFile, ref, result;
      event.preventDefault();
      event.stopPropagation();
      try {
        list = [];
        files = [];
        ref = event.dataTransfer.items;
        for (j = 0, len1 = ref.length; j < len1; j++) {
          i = ref[j];
          if (i.kind === "file") {
            file = i.getAsFile();
            files.push(file);
          }
        }
        result = [];
        index = 0;
        processFile = function() {
          var f;
          if (index < files.length) {
            f = files[index++];
            return loadFile(f, function(data) {
              result.push({
                name: f.name,
                size: f.size,
                content: data,
                file_type: f.type
              });
              return processFile();
            });
          } else {
            player.runtime.files_dropped = result;
            if (typeof window.dropHandler === "function") {
              return window.dropHandler(result);
            }
          }
        };
        return processFile();
      } catch (error) {
        err = error;
        return console.error(err);
      }
    });
  }

};

saveFile = function(data, name, type) {
  var a, blob, url;
  a = document.createElement("a");
  document.body.appendChild(a);
  a.style = "display: none";
  blob = new Blob([data], {
    type: type
  });
  url = window.URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  a.click();
  return window.URL.revokeObjectURL(url);
};

loadWaveFileLib = function(callback) {
  var s;
  if (typeof wavefile !== "undefined" && wavefile !== null) {
    return callback();
  } else {
    s = document.createElement("script");
    s.src = location.origin + "/lib/wavefile/wavefile.js";
    document.head.appendChild(s);
    return s.onload = function() {
      return callback();
    };
  }
};

loadLameJSLib = function(callback) {
  var s;
  if (typeof lamejs !== "undefined" && lamejs !== null) {
    return callback();
  } else {
    s = document.createElement("script");
    s.src = location.origin + "/lib/lamejs/lame.min.js";
    document.head.appendChild(s);
    return s.onload = function() {
      return callback();
    };
  }
};

writeProjectFile = function(name, data, thumb) {
  return window.player.postMessage({
    name: "write_project_file",
    filename: name,
    content: data,
    thumbnail: thumb
  });
};

arrayBufferToBase64 = function(buffer) {
  var binary, bytes, i, j, len, ref;
  binary = '';
  bytes = new Uint8Array(buffer);
  len = bytes.byteLength;
  for (i = j = 0, ref = len - 1; j <= ref; i = j += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

loadFile = function(file, callback) {
  var fr;
  switch (file.type) {
    case "image/png":
    case "image/jpeg":
      fr = new FileReader;
      fr.onload = function() {
        var img;
        img = new Image;
        img.onload = function() {
          var image;
          image = new msImage(img);
          return callback(image);
        };
        return img.src = fr.result;
      };
      return fr.readAsDataURL(file);
    case "audio/wav":
    case "audio/x-wav":
    case "audio/mp3":
      fr = new FileReader;
      fr.onload = function() {
        return player.runtime.audio.getContext().decodeAudioData(fr.result, function(buffer) {
          return callback(new Sound(player.runtime.audio, buffer));
        });
      };
      return fr.readAsArrayBuffer(file);
    case "application/json":
      fr = new FileReader;
      fr.onload = function() {
        var err, object;
        object = fr.result;
        try {
          object = JSON.parse(fr.result);
        } catch (error) {
          err = error;
        }
        return callback(object);
      };
      return fr.readAsText(file);
    default:
      fr = new FileReader;
      fr.onload = function() {
        return callback(fr.result);
      };
      return fr.readAsText(file);
  }
};

this.System = {
  javascript: function(s) {
    var err, f, res;
    try {
      f = eval(`res = function(global) { ${s} }`);
      res = f.call(player.runtime.vm.context.global, player.runtime.vm.context.global);
    } catch (error) {
      err = error;
      console.error(err);
    }
    if (res != null) {
      return res;
    } else {
      return 0;
    }
  },
  file: {
    save: function(obj, name, format, options) {
      var a, c;
      if (obj instanceof MicroSound) {
        return loadWaveFileLib(function() {
          var buffer, ch, ch1, ch2, i, j, k, ref, ref1, wav;
          wav = new wavefile.WaveFile;
          ch1 = [];
          for (i = j = 0, ref = obj.length - 1; j <= ref; i = j += 1) {
            ch1[i] = Math.round(Math.min(1, Math.max(-1, obj.read(0, i))) * 32767);
          }
          if (obj.channels === 2) {
            ch2 = [];
            for (i = k = 0, ref1 = obj.length - 1; k <= ref1; i = k += 1) {
              ch2[i] = Math.round(Math.min(1, Math.max(-1, obj.read(1, i))) * 32767);
            }
            ch = [ch1, ch2];
          } else {
            ch = [ch1];
          }
          wav.fromScratch(ch.length, obj.sampleRate, '16', ch);
          buffer = wav.toBuffer();
          if (typeof name !== "string") {
            name = "sound.wav";
          } else if (!name.endsWith(".wav")) {
            name += ".wav";
          }
          return saveFile(buffer, name, "octet/stream");
        });
      } else if (obj instanceof msImage) {
        c = obj.canvas;
        if (typeof name !== "string") {
          name = "image";
        }
        format = typeof format === "string" && format.toLowerCase() === "jpg" ? "jpg" : "png";
        if (!name.endsWith(`.${format}`)) {
          name += `.${format}`;
        }
        a = document.createElement("a");
        document.body.appendChild(a);
        a.style = "display: none";
        return c.toBlob(((blob) => {
          var url;
          url = window.URL.createObjectURL(blob);
          a.href = url;
          a.download = name;
          a.click();
          return window.URL.revokeObjectURL(url);
        }), (format === "png" ? "image/png" : "image/jpeg"), options);
      } else if (typeof obj === "object") {
        obj = System.runtime.vm.storableObject(obj);
        obj = JSON.stringify(obj, null, 2);
        if (typeof name !== "string") {
          name = "data";
        }
        if (!name.endsWith(".json")) {
          name += ".json";
        }
        return saveFile(obj, name, "text/json");
      } else if (typeof obj === "string") {
        if (typeof name !== "string") {
          name = "text";
        }
        if (!name.endsWith(".txt")) {
          name += ".txt";
        }
        return saveFile(obj, name, "text/plain");
      }
    },
    load: function(options, callback) {
      var extensions, i, input, j, ref;
      if (typeof options === "string" || Array.isArray(options)) {
        extensions = options;
      } else {
        extensions = options.extensions || null;
      }
      input = document.createElement("input");
      if (options.multiple) {
        input.multiple = true;
      }
      input.type = "file";
      if (typeof extensions === "string") {
        input.accept = `.${extensions}`;
      } else if (Array.isArray(extensions)) {
        for (i = j = 0, ref = extensions.length - 1; (0 <= ref ? j <= ref : j >= ref); i = 0 <= ref ? ++j : --j) {
          extensions[i] = `.${extensions[i]}`;
        }
        input.accept = extensions.join(",");
      }
      input.addEventListener("change", (event) => {
        var files, index, processFile, result;
        files = event.target.files;
        result = [];
        index = 0;
        processFile = function() {
          var f;
          if (index < files.length) {
            f = files[index++];
            return loadFile(f, function(data) {
              result.push({
                name: f.name,
                size: f.size,
                content: data,
                file_type: f.type
              });
              return processFile();
            });
          } else {
            player.runtime.files_loaded = result;
            if (typeof callback === "function") {
              return callback(result);
            }
          }
        };
        return processFile();
      });
      return input.click();
    },
    setDropHandler: function(handler) {
      return window.dropHandler = handler;
    }
  }
};

this.Watcher = class Watcher {
  constructor(runtime) {
    this.runtime = runtime;
    this.vm = this.runtime.vm;
  }

  update() {
    if (this.watching_variables) {
      return this.step();
    }
  }

  watch(variables) {
    this.watching = true;
    this.watching_variables = variables;
    this.exclusion_list = [this.vm.context.global.screen, this.vm.context.global.system, this.vm.context.global.keyboard, this.vm.context.global.audio, this.vm.context.global.gamepad, this.vm.context.global.touch, this.vm.context.global.mouse, this.vm.context.global.sprites, this.vm.context.global.maps, this.vm.context.global.sounds, this.vm.context.global.music, this.vm.context.global.assets, this.vm.context.global.asset_manager, this.vm.context.global.fonts, this.vm.context.global.storage];
    if (this.vm.context.global.Function != null) {
      this.exclusion_list.push(this.vm.context.global.Function);
    }
    if (this.vm.context.global.String != null) {
      this.exclusion_list.push(this.vm.context.global.String);
    }
    if (this.vm.context.global.List != null) {
      this.exclusion_list.push(this.vm.context.global.List);
    }
    if (this.vm.context.global.Number != null) {
      this.exclusion_list.push(this.vm.context.global.Number);
    }
    if (this.vm.context.global.Object != null) {
      this.exclusion_list.push(this.vm.context.global.Object);
    }
    if (this.vm.context.global.Image != null) {
      this.exclusion_list.push(this.vm.context.global.Image);
    }
    if (this.vm.context.global.Sound != null) {
      this.exclusion_list.push(this.vm.context.global.Sound);
    }
    if (this.vm.context.global.Sprite != null) {
      this.exclusion_list.push(this.vm.context.global.Sprite);
    }
    if (this.vm.context.global.Map != null) {
      this.exclusion_list.push(this.vm.context.global.Map);
    }
    if (this.vm.context.global.random != null) {
      this.exclusion_list.push(this.vm.context.global.random);
    }
    if (this.vm.context.global.print != null) {
      this.exclusion_list.push(this.vm.context.global.print);
    }
    return this.step();
  }

  stop() {
    return this.watching = false;
  }

  step(variables = this.watching_variables) {
    var index, j, len, res, v, value, vs;
    if (!this.watching) {
      return;
    }
    res = {};
    for (j = 0, len = variables.length; j < len; j++) {
      v = variables[j];
      if (v === "global") {
        value = this.vm.context.global;
      } else {
        vs = v.split(".");
        value = this.vm.context.global;
        index = 0;
        while (index < vs.length && (value != null)) {
          value = value[vs[index++]];
        }
      }
      if ((value != null) && this.exclusion_list.indexOf(value) < 0) {
        res[v] = this.exploreValue(value, 1, 10);
      }
    }
    return this.runtime.listener.postMessage({
      name: "watch_update",
      data: res
    });
  }

  exploreValue(value, depth = 1, array_max = 10) {
    var i, j, key, len, res, v;
    if (value == null) {
      return {
        type: "number",
        value: 0
      };
    }
    if (typeof value === "function" || value instanceof Program.Function || (typeof Routine !== "undefined" && Routine !== null) && value instanceof Routine) {
      return {
        type: "function",
        value: ""
      };
    } else if (typeof value === "object") {
      if (Array.isArray(value)) {
        if (depth === 0) {
          return {
            type: "list",
            value: "",
            length: value.length
          };
        }
        res = [];
        for (i = j = 0, len = value.length; j < len; i = ++j) {
          v = value[i];
          if (i >= 100) {
            break;
          }
          if (this.exclusion_list.indexOf(v) < 0) {
            res[i] = this.exploreValue(v, depth - 1, array_max);
          }
        }
        return res;
      } else {
        if (depth === 0) {
          v = "";
          if (value.classname) {
            v = "class " + value.classname;
          }
          if ((value.class != null) && (value.class.classname != null)) {
            v = value.class.classname;
          }
          return {
            type: "object",
            value: v
          };
        }
        res = {};
        for (key in value) {
          v = value[key];
          if (this.exclusion_list.indexOf(v) < 0) {
            res[key] = this.exploreValue(v, depth - 1, array_max);
          }
        }
        return res;
      }
    } else if (typeof value === "string") {
      return {
        type: "string",
        value: value.length < 43 ? value : value.substring(0, 40) + "..."
      };
    } else if (typeof value === "number") {
      return {
        type: "number",
        value: isFinite(value) ? value : 0
      };
    } else if (typeof value === "boolean") {
      return {
        type: "number",
        value: value ? 1 : 0
      };
    } else {
      return {
        type: "unknown",
        value: value
      };
    }
  }

};

this.ProjectInterface = class ProjectInterface {
  constructor(runtime) {
    this.runtime = runtime;
    this.interface = {
      listFiles: (path, callback) => {
        return this.listFiles(path, callback);
      },
      readFile: (path, callback) => {
        return this.readFile(path, callback);
      },
      writeFile: (path, obj, options, callback) => {
        return this.writeFile(path, obj, options, callback);
      },
      deleteFile: (path, callback) => {
        return this.deleteFile(path, callback);
      }
    };
  }

  callback(callback, data, res, error) {
    if (error != null) {
      res.error = error;
      res.ready = 1;
      if (typeof callback === "function") {
        return callback(0, error);
      }
    } else {
      res.data = data;
      res.ready = 1;
      if (typeof callback === "function") {
        return callback(data);
      }
    }
  }

  writeFile(path, obj, options, callback) {
    var kind;
    kind = path.split("/")[0];
    switch (kind) {
      case "source":
        return this.writeSourceFile(obj, path, options, callback);
      case "sprites":
        return this.writeSpriteFile(obj, path, options, callback);
      case "maps":
        return this.writeMapFile(obj, path, options, callback);
      case "sounds":
        return this.writeSoundFile(obj, path, options, callback);
      case "music":
        return this.writeMusicFile(obj, path, options, callback);
      case "assets":
        return this.writeAssetFile(obj, path, options, callback);
      default:
        return callback(0, `Root folder ${kind} does not exist`);
    }
  }

  writeSourceFile(obj, path, options, callback) {
    var msg, res;
    res = {
      ready: 0
    };
    if (typeof obj !== "string") {
      this.callback(callback, 0, res, "Incorrect object type, expected string");
    } else {
      msg = {
        name: "write_project_file",
        path: path,
        content: obj,
        options: options
      };
      this.runtime.listener.postRequest(msg, (result) => {
        return this.callback(callback, result.content, res, result.error);
      });
    }
    return res;
  }

  writeSpriteFile(obj, path, options, callback) {
    var canvas, context, fps, frames, i, j, msg, ref, res;
    res = {
      ready: 0
    };
    if (obj instanceof msImage) {
      msg = {
        name: "write_project_file",
        path: path,
        content: obj.canvas.toDataURL().split(",")[1],
        options: options
      };
      this.runtime.listener.postRequest(msg, (result) => {
        return this.callback(callback, result.content, res, result.error);
      });
    } else if (obj instanceof Sprite) {
      fps = obj.fps;
      if (obj.frames.length === 1) {
        canvas = obj.frames[0].canvas;
        frames = 1;
      } else {
        canvas = document.createElement("canvas");
        canvas.width = obj.width;
        canvas.height = obj.height * obj.frames.length;
        context = canvas.getContext("2d");
        for (i = j = 0, ref = obj.frames.length - 1; (0 <= ref ? j <= ref : j >= ref); i = 0 <= ref ? ++j : --j) {
          context.drawImage(obj.frames[i].canvas, 0, i * obj.height);
        }
        frames = obj.frames.length;
      }
      msg = {
        name: "write_project_file",
        path: path,
        content: canvas.toDataURL().split(",")[1],
        fps: fps,
        frames: frames,
        options: options
      };
      this.runtime.listener.postRequest(msg, (result) => {
        return this.callback(callback, result.content, res, result.error);
      });
    } else {
      this.callback(callback, 0, res, "Incorrect object type, expected Image or Sprite");
    }
    return res;
  }

  writeMapFile(obj, path, options, callback) {
    var msg, res;
    res = {
      ready: 0
    };
    if (obj instanceof MicroMap) {
      msg = {
        name: "write_project_file",
        path: path,
        content: SaveMap(obj),
        options: options
      };
      this.runtime.listener.postRequest(msg, (result) => {
        return this.callback(callback, result.content, res, result.error);
      });
    } else {
      this.callback(callback, 0, res, "Incorrect object type, expected Map");
    }
    return res;
  }

  writeSoundFile(obj, path, options, callback) {
    var res;
    res = {
      ready: 0
    };
    if (obj instanceof MicroSound) {
      loadWaveFileLib(() => {
        var buffer, ch, ch1, ch2, encoded, i, j, k, msg, ref, ref1, wav;
        wav = new wavefile.WaveFile;
        ch1 = [];
        for (i = j = 0, ref = obj.length - 1; j <= ref; i = j += 1) {
          ch1[i] = Math.round(Math.min(1, Math.max(-1, obj.read(0, i))) * 32767);
        }
        if (obj.channels === 2) {
          ch2 = [];
          for (i = k = 0, ref1 = obj.length - 1; k <= ref1; i = k += 1) {
            ch2[i] = Math.round(Math.min(1, Math.max(-1, obj.read(1, i))) * 32767);
          }
          ch = [ch1, ch2];
        } else {
          ch = [ch1];
        }
        wav.fromScratch(ch.length, obj.sampleRate, '16', ch);
        buffer = wav.toBuffer();
        encoded = arrayBufferToBase64(buffer);
        msg = {
          name: "write_project_file",
          path: path,
          content: encoded,
          options: options
        };
        return this.runtime.listener.postRequest(msg, (result) => {
          return this.callback(callback, result.content, res, result.error);
        });
      });
    } else {
      this.callback(callback, 0, res, "Incorrect object type, expected Sound");
    }
    return res;
  }

  writeMusicFile(obj, path, options, callback) {
    var res;
    res = {
      ready: 0
    };
    if (obj instanceof MicroSound) {
      loadLameJSLib(() => {
        var blob, fr, i, index, j, k, kbps, l, m, mp3Data, mp3buf, mp3encoder, ref, ref1, ref2, ref3, ref4, ref5, sampleBlockSize, samples, samplesR, toindex;
        kbps = 128;
        mp3encoder = new lamejs.Mp3Encoder(obj.channels, obj.sampleRate, kbps);
        index = 0;
        sampleBlockSize = 1152;
        samples = new Int16Array(sampleBlockSize);
        samplesR = new Int16Array(sampleBlockSize);
        mp3Data = [];
        while (index < obj.length) {
          toindex = Math.min(sampleBlockSize - 1, obj.length - index - 1);
          for (i = j = 0, ref = toindex; j <= ref; i = j += 1) {
            samples[i] = Math.round(32767 * Math.max(-1, Math.min(1, obj.read(0, index + i))));
          }
          if (obj.channels === 2) {
            for (i = k = 0, ref1 = toindex; k <= ref1; i = k += 1) {
              samplesR[i] = Math.round(32767 * Math.max(-1, Math.min(1, obj.read(1, index + i))));
            }
          }
          for (i = l = ref2 = toindex + 1, ref3 = sampleBlockSize - 1; l <= ref3; i = l += 1) {
            samples[i] = 0;
          }
          if (obj.channels === 2) {
            for (i = m = ref4 = toindex + 1, ref5 = sampleBlockSize - 1; m <= ref5; i = m += 1) {
              samplesR[i] = 0;
            }
          }
          index += sampleBlockSize;
          if (obj.channels === 2) {
            mp3buf = mp3encoder.encodeBuffer(samples, samplesR);
          } else {
            mp3buf = mp3encoder.encodeBuffer(samples);
          }
          if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
          }
        }
        mp3buf = mp3encoder.flush();
        if (mp3buf.length > 0) {
          mp3Data.push(mp3buf);
        }
        blob = new Blob(mp3Data, {
          type: 'audio/mp3'
        });
        fr = new FileReader();
        fr.onload = (e) => {
          var msg;
          msg = {
            name: "write_project_file",
            path: path,
            content: fr.result.split(",")[1],
            options: options
          };
          return this.runtime.listener.postRequest(msg, (result) => {
            return this.callback(callback, result.content, res, result.error);
          });
        };
        return fr.readAsDataURL(blob);
      });
    } else {
      this.callback(callback, 0, res, "Incorrect object type, expected Sound");
    }
    return res;
  }

  writeAssetFile(obj, path, options, callback) {
    var err, ext, mime, msg, ref, ref1, res;
    res = {
      ready: 0
    };
    if (obj instanceof msImage || obj instanceof Sprite) {
      if (obj instanceof Sprite) {
        obj = obj.frames[0];
      }
      if ((ref = options.ext) === "jpg" || ref === "png") {
        ext = options.ext;
      } else {
        ext = "png";
      }
      mime = ext === "jpg" ? "image/jpeg" : "image/png";
      msg = {
        name: "write_project_file",
        path: path,
        content: obj.canvas.toDataURL(mime),
        ext: ext,
        options: options
      };
      this.runtime.listener.postRequest(msg, (result) => {
        return this.callback(callback, result.content, res, result.error);
      });
    } else if (typeof obj === "string") {
      if ((ref1 = options.ext) === "txt" || ref1 === "csv" || ref1 === "obj" || ref1 === "json" || ref1 === "md") {
        ext = options.ext;
      } else {
        ext = "txt";
      }
      if (ext === "json" && typeof obj === "string") {
        try {
          obj = JSON.parse(obj);
        } catch (error1) {
          err = error1;
        }
      }
      msg = {
        name: "write_project_file",
        path: path,
        content: obj,
        ext: ext,
        options: options
      };
      this.runtime.listener.postRequest(msg, (result) => {
        return this.callback(callback, result.content, res, result.error);
      });
    } else if (typeof obj === "object") {
      obj = this.runtime.vm.storableObject(obj);
      msg = {
        name: "write_project_file",
        path: path,
        content: obj,
        ext: "json",
        options: options
      };
      this.runtime.listener.postRequest(msg, (result) => {
        return this.callback(callback, result.content, res, result.error);
      });
    } else {
      this.callback(callback, 0, res, "Unrecognized object type");
    }
    return res;
  }

  listFiles(path, callback) {
    var msg, res;
    msg = {
      name: "list_project_files",
      path: path
    };
    res = {
      ready: 0
    };
    this.runtime.listener.postRequest(msg, function(result) {
      res.ready = 1;
      if (result.list) {
        res.list = result.list;
      }
      if (result.error) {
        res.error = result.error;
      }
      if (typeof callback === "function") {
        return callback(result.list, result.error);
      }
    });
    return res;
  }

  readFile(path, callback) {
    var kind, msg, res;
    msg = {
      name: "read_project_file",
      path: path
    };
    res = {
      ready: 0
    };
    kind = path.split("/")[0];
    this.runtime.listener.postRequest(msg, (result) => {
      var img, map, s;
      res.ready = 1;
      if (result.error) {
        res.error = result.error;
        if (typeof callback === "function") {
          return callback(0, result.error);
        }
      } else {
        switch (kind) {
          case "sprites":
            s = LoadSprite(result.content.data, {
              fps: result.content.fps,
              frames: result.content.frames
            }, () => {
              res.result = s;
              if (typeof callback === "function") {
                return callback(res.result, 0);
              }
            });
            break;
          case "maps":
            map = new MicroMap(1, 1, 1, 1);
            UpdateMap(map, result.content);
            res.result = map;
            if (typeof callback === "function") {
              callback(res.result, 0);
            }
            break;
          case "sounds":
          case "music":
            s = new Sound(this.runtime.audio, result.content);
            res.result = s;
            if (typeof callback === "function") {
              callback(s, 0);
            }
            break;
          case "assets":
            switch (result.content.type) {
              case "text":
                res.result = result.content.data;
                callback(res.result, 0);
                break;
              case "json":
                res.result = result.content.data;
                callback(res.result, 0);
                break;
              case "image":
                img = new Image;
                img.src = result.content.data;
                img.onload = () => {
                  var image;
                  image = new msImage(img);
                  res.result = image;
                  return callback(res.result, 0);
                };
            }
            break;
          default:
            res.result = result.content.toString();
            if (typeof callback === "function") {
              return callback(res.result, 0);
            }
        }
      }
    });
    return res;
  }

  deleteFile(path, callback) {
    var msg, res;
    msg = {
      name: "delete_project_file",
      path: path
    };
    res = {
      ready: 0
    };
    this.runtime.listener.postRequest(msg, function(result) {
      res.ready = 1;
      res.result = result.content || 0;
      if (result.error) {
        res.error = result.error;
      }
      if (typeof callback === "function") {
        return callback(res.result, result.error);
      }
    });
    return res;
  }

};

this.TimeMachine = class TimeMachine {
  constructor(runtime) {
    this.runtime = runtime;
    this.history = [];
    this.record_index = 0;
    this.replay_position = 0;
    this.recording = false;
    this.max_length = 60 * 30;
    this.record_length = 0;
    this.loop_length = 60 * 4;
  }

  step() {
    var end, err, histo, i, index, j, ref, ref1, start;
    if (this.recording) {
      try {
        if (this.replay_position !== 0) {
          histo = [];
          start = this.record_length;
          end = this.replay_position + 1;
          for (i = j = ref = start, ref1 = end; j >= ref1; i = j += -1) {
            index = (this.record_index - i + this.max_length) % this.max_length;
            histo.push(this.history[index]);
          }
          if (this.looping) {
            this.loop_start = this.loop_length;
          }
          this.history = histo;
          this.record_index = this.history.length;
          this.record_length = this.history.length;
          this.replay_position = 0;
        }
        this.history[this.record_index++] = this.storableHistory(this.runtime.vm.context.global);
        this.record_length = Math.min(this.record_length + 1, this.max_length);
        if (this.record_index >= this.max_length) {
          this.record_index = 0;
        }
        return this.sendStatus();
      } catch (error) {
        err = error;
        return console.error(err);
      }
    }
  }

  messageReceived(data) {
    var pos;
    switch (data.command) {
      case "start_recording":
        if (!this.recording) {
          this.recording = true;
          this.record_index = 0;
          this.replay_position = 0;
          this.record_length = 0;
          this.history = [];
          return this.sendStatus();
        }
        break;
      case "stop_recording":
        if (this.recording) {
          this.recording = false;
          return this.sendStatus();
        }
        break;
      case "step_backward":
        return this.stepBackward();
      case "step_forward":
        return this.stepForward();
      case "replay_position":
        pos = Math.round(data.position);
        this.replay_position = Math.max(2, Math.min(this.record_length - 1, pos));
        if (this.looping) {
          this.loop_start = this.replay_position;
          this.loop_index = 0;
        }
        this.replay();
        return this.sendStatus();
      case "start_looping":
        if (this.record_length === 0) {
          return;
        }
        this.looping = true;
        this.recording = false;
        this.loop_start = Math.max(this.replay_position, 1);
        this.loop_index = 0;
        return this.loop();
      case "stop_looping":
        return this.stopLooping();
    }
  }

  stopLooping() {
    if (this.looping) {
      this.looping = false;
      this.replay_position = this.loop_start;
      return this.sendStatus();
    }
  }

  loop() {
    if (!this.looping) {
      return;
    }
    requestAnimationFrame(() => {
      return this.loop();
    });
    if (this.loop_index === 0) {
      this.replay_position = this.loop_start;
      this.replay(true);
      this.loop_index += 1;
    } else {
      this.loop_index += 1;
      if (this.loop_index > this.loop_length) {
        this.loop_index = 0;
      }
      this.replay_position = this.loop_start - this.loop_index;
      this.replayControls();
      this.runtime.updateCall();
      this.runtime.drawCall();
      this.runtime.watchStep();
      this.resetControls();
    }
    return this.sendStatus();
  }

  stepBackward() {
    if (this.replay_position + 1 >= this.record_length) {
      return;
    }
    this.stopLooping();
    this.replay_position += 1;
    this.replay();
    return this.sendStatus();
  }

  stepForward() {
    if (this.replay_position <= 1) {
      return;
    }
    this.stopLooping();
    this.replay_position--;
    this.replay();
    return this.sendStatus();
  }

  replayControls() {
    var index;
    if (this.replay_position >= this.record_length) {
      return;
    }
    if (this.replay_position <= 0) {
      return;
    }
    index = (this.record_index - this.replay_position + this.max_length) % this.max_length;
    this.copyGlobal(this.history[index].keyboard, this.runtime.vm.context.global.keyboard);
    this.copyGlobal(this.history[index].gamepad, this.runtime.vm.context.global.gamepad);
    this.copyGlobal(this.history[index].touch, this.runtime.vm.context.global.touch);
    return this.copyGlobal(this.history[index].mouse, this.runtime.vm.context.global.mouse);
  }

  resetControls() {
    var mouse, touch;
    this.runtime.keyboard.reset();
    touch = this.runtime.vm.context.global.touch;
    touch.touching = 0;
    touch.touches = [];
    mouse = this.runtime.vm.context.global.mouse;
    mouse.pressed = 0;
    mouse.left = 0;
    mouse.right = 0;
    return mouse.middle = 0;
  }

  replay(clone = false) {
    var index;
    index = (this.record_index - this.replay_position + this.max_length) % this.max_length;
    this.copyGlobal((clone ? this.storableHistory(this.history[index]) : this.history[index]), this.runtime.vm.context.global);
    //@runtime.vm.context.global = if clone then @storableHistory(@history[index]) else @history[index]
    //@runtime.vm.context.meta.global = @runtime.vm.context.global
    //@runtime.vm.context.object = @runtime.vm.context.global
    //@runtime.vm.context.local = @runtime.vm.context.global
    this.runtime.vm.call("draw");
    if (this.runtime.vm.runner.tick != null) {
      this.runtime.vm.runner.tick();
    }
    return this.runtime.watchStep();
  }

  copyGlobal(source, dest) {
    var key, value;
    for (key in source) {
      value = source[key];
      if (key === "keyboard" || key === "gamepad" || key === "touch" || key === "mouse") {
        continue;
      }
      if (((typeof Routine === "undefined" || Routine === null) || !(value instanceof Routine)) && !(value instanceof Program.Function) && typeof value !== "function" && (value.classname == null)) {
        dest[key] = value;
      }
    }
    for (key in dest) {
      if (source[key] == null) {
        delete dest[key];
      }
    }
  }

  sendStatus() {
    return this.runtime.listener.postMessage({
      name: "time_machine",
      command: "status",
      length: this.record_length,
      head: this.record_length - this.replay_position,
      max: this.max_length
    });
  }

  storableHistory(value) {
    var clones, global, refs;
    global = this.runtime.vm.context.global;
    this.excluded = [
      global.screen,
      global.system,
      //global.keyboard
      global.audio,
      //global.gamepad
      //global.touch
      //global.mouse
      global.sprites,
      global.maps,
      global.sounds,
      global.music,
      global.assets,
      global.asset_manager,
      global.fonts,
      global.storage,
      window
    ];
    if (global.PIXI != null) {
      // for key,value of window
      //   @excluded.push value
      this.excluded.push(global.PIXI);
    }
    if (global.BABYLON != null) {
      this.excluded.push(global.BABYLON);
    }
    if (global.M2D != null) {
      this.excluded.push(global.M2D);
    }
    if (global.M3D != null) {
      this.excluded.push(global.M3D);
    }
    if (global.Matter != null) {
      this.excluded.push(global.Matter);
    }
    if (global.CANNON != null) {
      this.excluded.push(global.CANNON);
    }
    if (global.Object != null) {
      this.excluded.push(global.Object);
    }
    if (global.List != null) {
      this.excluded.push(global.List);
    }
    if (global.String != null) {
      this.excluded.push(global.String);
    }
    if (global.Number != null) {
      this.excluded.push(global.Number);
    }
    if (global.Function != null) {
      this.excluded.push(global.Function);
    }
    if (global.random != null) {
      this.excluded.push(global.random);
    }
    refs = [];
    clones = [];
    return this.makeStorableObject(value, refs, clones);
  }

  makeStorableObject(value, refs, clones) {
    var i, index, j, key, len, res, v;
    if (value == null) {
      return value;
    }
    if (typeof value === "function" || value instanceof Program.Function || (typeof Routine !== "undefined" && Routine !== null) && value instanceof Routine) {
      return value;
    } else if (typeof value === "object") {
      if (this.excluded.indexOf(value) >= 0) {
        return value;
      }
      if (value instanceof Sprite || value instanceof MicroMap || value instanceof msImage || value instanceof MicroSound) {
        return value;
      }
      if (value.classname != null) {
        return value;
      }
      index = refs.indexOf(value);
      if (index >= 0) {
        return clones[index];
      }
      if (Array.isArray(value)) {
        res = [];
        refs.push(value);
        clones.push(res);
        for (i = j = 0, len = value.length; j < len; i = ++j) {
          v = value[i];
          v = this.makeStorableObject(v, refs, clones);
          if (v != null) {
            res[i] = v;
          }
        }
        return res;
      } else {
        res = {};
        refs.push(value);
        clones.push(res);
        for (key in value) {
          v = value[key];
          v = this.makeStorableObject(v, refs, clones);
          if (v != null) {
            res[key] = v;
          }
        }
        return res;
      }
    } else {
      return value;
    }
  }

};

this.Screen = class Screen {
  constructor(runtime) {
    this.runtime = runtime;
    this.canvas = document.createElement("canvas");
    this.canvas.width = 1080;
    this.canvas.height = 1920;
    this.touches = {};
    this.mouse = {
      x: -10000,
      y: -10000,
      pressed: 0,
      left: 0,
      middle: 0,
      right: 0,
      wheel: 0
    };
    this.alpha = 1;
    this.pixelated = 1;
    this.line_width = 1;
    this.translation_x = 0;
    this.translation_y = 0;
    this.rotation = 0;
    this.scale_x = 1;
    this.scale_y = 1;
    this.screen_transform = false;
    this.object_rotation = 0;
    this.object_scale_x = 1;
    this.object_scale_y = 1;
    this.anchor_x = 0;
    this.anchor_y = 0;
    this.supersampling = this.previous_supersampling = 1;
    this.font = "BitCell";
    this.font_load_requested = {};
    this.font_loaded = {};
    this.loadFont(this.font);
    this.initContext();
    this.cursor = "default";
    this.canvas.addEventListener("mousemove", () => {
      this.last_mouse_move = Date.now();
      if (this.cursor !== "default" && this.cursor_visibility === "auto") {
        this.cursor = "default";
        return this.canvas.style.cursor = "default";
      }
    });
    // when the context is lost and then restored, base transform needs to be reinstated.
    this.canvas.addEventListener("contextrestored", () => {
      return this.initContext();
    });
    setInterval((() => {
      return this.checkMouseCursor();
    }), 1000);
    this.cursor_visibility = "auto";
  }

  checkMouseCursor() {
    if (Date.now() > this.last_mouse_move + 4000 && this.cursor_visibility === "auto") {
      if (this.cursor !== "none") {
        this.cursor = "none";
        return this.canvas.style.cursor = "none";
      }
    }
  }

  setCursorVisible(visible) {
    this.cursor_visibility = visible;
    if (visible) {
      this.cursor = "default";
      return this.canvas.style.cursor = "default";
    } else {
      this.cursor = "none";
      return this.canvas.style.cursor = "none";
    }
  }

  initContext() {
    var b, c, j, len1, ratio, ref;
    c = this.canvas.getContext("2d", {
      alpha: false
    });
    if (c !== this.context) {
      this.context = c;
    } else {
      this.context.restore();
    }
    this.context.save();
    this.context.translate(this.canvas.width / 2, this.canvas.height / 2);
    ratio = Math.min(this.canvas.width / 200, this.canvas.height / 200);
    this.context.scale(ratio, ratio);
    this.width = this.canvas.width / ratio;
    this.height = this.canvas.height / ratio;
    // @translation_x = 0
    // @translation_y = 0
    // @rotation = 0
    // @scale_x = 1
    // @scale_y = 1
    // @screen_transform = false
    this.context.lineCap = "round";
    this.blending = {
      normal: "source-over",
      additive: "lighter"
    };
    ref = ["source-over", "source-in", "source-out", "source-atop", "destination-over", "destination-in", "destination-out", "destination-atop", "lighter", "copy", "xor", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"];
    for (j = 0, len1 = ref.length; j < len1; j++) {
      b = ref[j];
      this.blending[b] = b;
    }
  }

  getInterface() {
    var screen;
    if (this.interface != null) {
      return this.interface;
    }
    screen = this;
    return this.interface = {
      width: this.width,
      height: this.height,
      clear: function(color) {
        return screen.clear(color);
      },
      setColor: function(color) {
        return screen.setColor(color);
      },
      setAlpha: function(alpha) {
        return screen.setAlpha(alpha);
      },
      setPixelated: function(pixelated) {
        return screen.setPixelated(pixelated);
      },
      setBlending: function(blending) {
        return screen.setBlending(blending);
      },
      setLinearGradient: function(x1, y1, x2, y2, c1, c2) {
        return screen.setLinearGradient(x1, y1, x2, y2, c1, c2);
      },
      setRadialGradient: function(x, y, radius, c1, c2) {
        return screen.setRadialGradient(x, y, radius, c1, c2);
      },
      setFont: function(font) {
        return screen.setFont(font);
      },
      setTranslation: function(tx, ty) {
        return screen.setTranslation(tx, ty);
      },
      setScale: function(x, y) {
        return screen.setScale(x, y);
      },
      setRotation: function(rotation) {
        return screen.setRotation(rotation);
      },
      setDrawAnchor: function(ax, ay) {
        return screen.setDrawAnchor(ax, ay);
      },
      setDrawRotation: function(rotation) {
        return screen.setDrawRotation(rotation);
      },
      setDrawScale: function(x, y) {
        return screen.setDrawScale(x, y);
      },
      fillRect: function(x, y, w, h, c) {
        return screen.fillRect(x, y, w, h, c);
      },
      fillRoundRect: function(x, y, w, h, r, c) {
        return screen.fillRoundRect(x, y, w, h, r, c);
      },
      fillRound: function(x, y, w, h, c) {
        return screen.fillRound(x, y, w, h, c);
      },
      drawRect: function(x, y, w, h, c) {
        return screen.drawRect(x, y, w, h, c);
      },
      drawRoundRect: function(x, y, w, h, r, c) {
        return screen.drawRoundRect(x, y, w, h, r, c);
      },
      drawRound: function(x, y, w, h, c) {
        return screen.drawRound(x, y, w, h, c);
      },
      drawSprite: function(sprite, x, y, w, h) {
        return screen.drawSprite(sprite, x, y, w, h);
      },
      drawImage: function(sprite, x, y, w, h) {
        return screen.drawSprite(sprite, x, y, w, h);
      },
      drawSpritePart: function(sprite, sx, sy, sw, sh, x, y, w, h) {
        return screen.drawSpritePart(sprite, sx, sy, sw, sh, x, y, w, h);
      },
      drawImagePart: function(sprite, sx, sy, sw, sh, x, y, w, h) {
        return screen.drawSpritePart(sprite, sx, sy, sw, sh, x, y, w, h);
      },
      drawMap: function(map, x, y, w, h) {
        return screen.drawMap(map, x, y, w, h);
      },
      drawText: function(text, x, y, size, color) {
        return screen.drawText(text, x, y, size, color);
      },
      drawTextOutline: function(text, x, y, size, color) {
        return screen.drawTextOutline(text, x, y, size, color);
      },
      textWidth: function(text, size) {
        return screen.textWidth(text, size);
      },
      setLineWidth: function(width) {
        return screen.setLineWidth(width);
      },
      setLineDash: function(dash) {
        return screen.setLineDash(dash);
      },
      drawLine: function(x1, y1, x2, y2, color) {
        return screen.drawLine(x1, y1, x2, y2, color);
      },
      drawPolygon: function() {
        return screen.drawPolygon(arguments);
      },
      drawPolyline: function() {
        return screen.drawPolyline(arguments);
      },
      fillPolygon: function() {
        return screen.fillPolygon(arguments);
      },
      drawQuadCurve: function() {
        return screen.drawQuadCurve(arguments);
      },
      drawBezierCurve: function() {
        return screen.drawBezierCurve(arguments);
      },
      drawArc: function(x, y, radius, angle1, angle2, ccw, color) {
        return screen.drawArc(x, y, radius, angle1, angle2, ccw, color);
      },
      fillArc: function(x, y, radius, angle1, angle2, ccw, color) {
        return screen.fillArc(x, y, radius, angle1, angle2, ccw, color);
      },
      setCursorVisible: function(visible) {
        return screen.setCursorVisible(visible);
      },
      loadFont: function(font) {
        return screen.loadFont(font);
      },
      isFontReady: function(font) {
        return screen.isFontReady(font);
      }
    };
  }

  updateInterface() {
    if (this.interface != null) {
      this.interface.width = this.width;
      return this.interface.height = this.height;
    }
  }

  clear(color) {
    var blending_save, c, s;
    c = this.context.fillStyle;
    s = this.context.strokeStyle;
    blending_save = this.context.globalCompositeOperation;
    this.context.globalAlpha = 1;
    this.context.globalCompositeOperation = "source-over";
    if (color != null) {
      this.setColor(color);
    } else {
      this.context.fillStyle = "#000";
    }
    this.context.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
    this.context.fillStyle = c;
    this.context.strokeStyle = s;
    return this.context.globalCompositeOperation = blending_save;
  }

  initDraw() {
    this.alpha = 1;
    this.line_width = 1;
    if (this.supersampling !== this.previous_supersampling) {
      this.resize();
      return this.previous_supersampling = this.supersampling;
    }
  }

  setColor(color) {
    var b, c, g, r;
    if (color == null) {
      return;
    }
    if (!Number.isNaN(Number.parseInt(color))) {
      r = (Math.floor(color / 100) % 10) / 9 * 255;
      g = (Math.floor(color / 10) % 10) / 9 * 255;
      b = (Math.floor(color) % 10) / 9 * 255;
      c = 0xFF000000;
      c += r << 16;
      c += g << 8;
      c += b;
      c = "#" + c.toString(16).substring(2, 8);
      this.context.fillStyle = c;
      return this.context.strokeStyle = c;
    } else if (typeof color === "string") {
      this.context.fillStyle = color;
      return this.context.strokeStyle = color;
    }
  }

  setAlpha(alpha1) {
    this.alpha = alpha1;
  }

  setPixelated(pixelated1) {
    this.pixelated = pixelated1;
  }

  setBlending(blending) {
    blending = this.blending[blending || "normal"] || "source-over";
    return this.context.globalCompositeOperation = blending;
  }

  setLineWidth(line_width) {
    this.line_width = line_width;
  }

  setLineDash(dash) {
    if (!Array.isArray(dash)) {
      return this.context.setLineDash([]);
    } else {
      return this.context.setLineDash(dash);
    }
  }

  setLinearGradient(x1, y1, x2, y2, c1, c2) {
    var grd;
    grd = this.context.createLinearGradient(x1, -y1, x2, -y2);
    grd.addColorStop(0, c1);
    grd.addColorStop(1, c2);
    this.context.fillStyle = grd;
    return this.context.strokeStyle = grd;
  }

  setRadialGradient(x, y, radius, c1, c2) {
    var grd;
    grd = this.context.createRadialGradient(x, -y, 0, x, -y, radius);
    grd.addColorStop(0, c1);
    grd.addColorStop(1, c2);
    this.context.fillStyle = grd;
    return this.context.strokeStyle = grd;
  }

  setFont(font) {
    this.font = font || "Verdana";
    return this.loadFont(this.font);
  }

  loadFont(font = "BitCell") {
    var err;
    if (!this.font_load_requested[font]) {
      this.font_load_requested[font] = true;
      try {
        if ((document.fonts != null) && (document.fonts.load != null)) {
          document.fonts.load(`16pt ${font}`);
        }
      } catch (error) {
        err = error;
      }
    }
    return 1;
  }

  isFontReady(font = this.font) {
    var err, res;
    if (this.font_loaded[font]) {
      return 1;
    }
    try {
      if ((document.fonts != null) && (document.fonts.check != null)) {
        res = document.fonts.check(`16pt ${font}`);
        if (res) {
          this.font_loaded[font] = res;
        }
        if (res) {
          return 1;
        } else {
          return 0;
        }
      }
    } catch (error) {
      err = error;
    }
    return 1;
  }

  setTranslation(translation_x, translation_y) {
    this.translation_x = translation_x;
    this.translation_y = translation_y;
    if (!isFinite(this.translation_x)) {
      this.translation_x = 0;
    }
    if (!isFinite(this.translation_y)) {
      this.translation_y = 0;
    }
    return this.updateScreenTransform();
  }

  setScale(scale_x, scale_y) {
    this.scale_x = scale_x;
    this.scale_y = scale_y;
    if (!isFinite(this.scale_x) || this.scale_x === 0) {
      this.scale_x = 1;
    }
    if (!isFinite(this.scale_y) || this.scale_y === 0) {
      this.scale_y = 1;
    }
    return this.updateScreenTransform();
  }

  setRotation(rotation1) {
    this.rotation = rotation1;
    if (!isFinite(this.rotation)) {
      this.rotation = 0;
    }
    return this.updateScreenTransform();
  }

  updateScreenTransform() {
    return this.screen_transform = this.translation_x !== 0 || this.translation_y !== 0 || this.scale_x !== 1 || this.scale_y !== 1 || this.rotation !== 0;
  }

  setDrawAnchor(anchor_x, anchor_y) {
    this.anchor_x = anchor_x;
    this.anchor_y = anchor_y;
    if (typeof this.anchor_x !== "number") {
      this.anchor_x = 0;
    }
    if (typeof this.anchor_y !== "number") {
      return this.anchor_y = 0;
    }
  }

  setDrawRotation(object_rotation) {
    this.object_rotation = object_rotation;
  }

  setDrawScale(object_scale_x, object_scale_y = this.object_scale_x) {
    this.object_scale_x = object_scale_x;
    this.object_scale_y = object_scale_y;
  }

  initDrawOp(x, y, object_transform = true) {
    var res;
    res = false;
    if (this.screen_transform) {
      this.context.save();
      res = true;
      this.context.translate(this.translation_x, -this.translation_y);
      this.context.scale(this.scale_x, this.scale_y);
      this.context.rotate(-this.rotation / 180 * Math.PI);
      this.context.translate(x, y);
    }
    if (object_transform && (this.object_rotation !== 0 || this.object_scale_x !== 1 || this.object_scale_y !== 1)) {
      if (!res) {
        this.context.save();
        res = true;
        this.context.translate(x, y);
      }
      if (this.object_rotation !== 0) {
        this.context.rotate(-this.object_rotation / 180 * Math.PI);
      }
      if (this.object_scale_x !== 1 || this.object_scale_y !== 1) {
        this.context.scale(this.object_scale_x, this.object_scale_y);
      }
    }
    return res;
  }

  closeDrawOp(x, y) {
    //if @object_scale_x != 1 or @object_scale_y != 1
    //  @context.scale 1/@object_scale_x,1/@object_scale_y

    //if @object_rotation != 0
    //  @context.rotate -@object_rotation/180*Math.PI
    //@context.translate -x,-y
    return this.context.restore();
  }

  fillRect(x, y, w, h, color) {
    this.setColor(color);
    this.context.globalAlpha = this.alpha;
    if (this.initDrawOp(x, -y)) {
      this.context.fillRect(-w / 2 - this.anchor_x * w / 2, -h / 2 + this.anchor_y * h / 2, w, h);
      return this.closeDrawOp(x, -y);
    } else {
      return this.context.fillRect(x - w / 2 - this.anchor_x * w / 2, -y - h / 2 + this.anchor_y * h / 2, w, h);
    }
  }

  fillRoundRect(x, y, w, h, round = 10, color) {
    this.setColor(color);
    this.context.globalAlpha = this.alpha;
    if (this.initDrawOp(x, -y)) {
      this.context.fillRoundRect(-w / 2 - this.anchor_x * w / 2, -h / 2 + this.anchor_y * h / 2, w, h, round);
      return this.closeDrawOp(x, -y);
    } else {
      return this.context.fillRoundRect(x - w / 2 - this.anchor_x * w / 2, -y - h / 2 + this.anchor_y * h / 2, w, h, round);
    }
  }

  fillRound(x, y, w, h, color) {
    this.setColor(color);
    this.context.globalAlpha = this.alpha;
    w = Math.abs(w);
    h = Math.abs(h);
    if (this.initDrawOp(x, -y)) {
      this.context.beginPath();
      this.context.ellipse(-this.anchor_x * w / 2, 0 + this.anchor_y * h / 2, w / 2, h / 2, 0, 0, Math.PI * 2, false);
      this.context.fill();
      return this.closeDrawOp(x, -y);
    } else {
      this.context.beginPath();
      this.context.ellipse(x - this.anchor_x * w / 2, -y + this.anchor_y * h / 2, w / 2, h / 2, 0, 0, Math.PI * 2, false);
      return this.context.fill();
    }
  }

  drawRect(x, y, w, h, color) {
    this.setColor(color);
    this.context.globalAlpha = this.alpha;
    this.context.lineWidth = this.line_width;
    if (this.initDrawOp(x, -y)) {
      this.context.strokeRect(-w / 2 - this.anchor_x * w / 2, -h / 2 + this.anchor_y * h / 2, w, h);
      return this.closeDrawOp(x, -y);
    } else {
      return this.context.strokeRect(x - w / 2 - this.anchor_x * w / 2, -y - h / 2 + this.anchor_y * h / 2, w, h);
    }
  }

  drawRoundRect(x, y, w, h, round = 10, color) {
    this.setColor(color);
    this.context.globalAlpha = this.alpha;
    this.context.lineWidth = this.line_width;
    if (this.initDrawOp(x, -y)) {
      this.context.strokeRoundRect(-w / 2 - this.anchor_x * w / 2, -h / 2 + this.anchor_y * h / 2, w, h, round);
      return this.closeDrawOp(x, -y);
    } else {
      return this.context.strokeRoundRect(x - w / 2 - this.anchor_x * w / 2, -y - h / 2 + this.anchor_y * h / 2, w, h, round);
    }
  }

  drawRound(x, y, w, h, color) {
    this.setColor(color);
    this.context.globalAlpha = this.alpha;
    this.context.lineWidth = this.line_width;
    w = Math.abs(w);
    h = Math.abs(h);
    if (this.initDrawOp(x, -y)) {
      this.context.beginPath();
      this.context.ellipse(0 - this.anchor_x * w / 2, 0 + this.anchor_y * h / 2, w / 2, h / 2, 0, 0, Math.PI * 2, false);
      this.context.stroke();
      return this.closeDrawOp(x, -y);
    } else {
      this.context.beginPath();
      this.context.ellipse(x - this.anchor_x * w / 2, -y + this.anchor_y * h / 2, w / 2, h / 2, 0, 0, Math.PI * 2, false);
      return this.context.stroke();
    }
  }

  drawLine(x1, y1, x2, y2, color) {
    var transform;
    this.setColor(color);
    this.context.globalAlpha = this.alpha;
    this.context.lineWidth = this.line_width;
    transform = this.initDrawOp(0, 0, false);
    this.context.beginPath();
    this.context.moveTo(x1, -y1);
    this.context.lineTo(x2, -y2);
    this.context.stroke();
    if (transform) {
      return this.closeDrawOp();
    }
  }

  drawPolyline(args) {
    var i, j, len, ref, transform;
    if (args.length > 0 && args.length % 2 === 1 && typeof args[args.length - 1] === "string") {
      this.setColor(args[args.length - 1]);
    }
    if (Array.isArray(args[0])) {
      if ((args[1] != null) && typeof args[1] === "string") {
        this.setColor(args[1]);
      }
      args = args[0];
    }
    this.context.globalAlpha = this.alpha;
    this.context.lineWidth = this.line_width;
    if (args.length < 4) {
      return;
    }
    len = Math.floor(args.length / 2);
    transform = this.initDrawOp(0, 0, false);
    this.context.beginPath();
    this.context.moveTo(args[0], -args[1]);
    for (i = j = 1, ref = len - 1; (1 <= ref ? j <= ref : j >= ref); i = 1 <= ref ? ++j : --j) {
      this.context.lineTo(args[i * 2], -args[i * 2 + 1]);
    }
    this.context.stroke();
    if (transform) {
      return this.closeDrawOp();
    }
  }

  drawPolygon(args) {
    var i, j, len, ref, transform;
    if (args.length > 0 && args.length % 2 === 1 && typeof args[args.length - 1] === "string") {
      this.setColor(args[args.length - 1]);
    }
    if (Array.isArray(args[0])) {
      if ((args[1] != null) && typeof args[1] === "string") {
        this.setColor(args[1]);
      }
      args = args[0];
    }
    this.context.globalAlpha = this.alpha;
    this.context.lineWidth = this.line_width;
    if (args.length < 4) {
      return;
    }
    len = Math.floor(args.length / 2);
    transform = this.initDrawOp(0, 0, false);
    this.context.beginPath();
    this.context.moveTo(args[0], -args[1]);
    for (i = j = 1, ref = len - 1; (1 <= ref ? j <= ref : j >= ref); i = 1 <= ref ? ++j : --j) {
      this.context.lineTo(args[i * 2], -args[i * 2 + 1]);
    }
    this.context.closePath();
    this.context.stroke();
    if (transform) {
      return this.closeDrawOp();
    }
  }

  fillPolygon(args) {
    var i, j, len, ref, transform;
    if (args.length > 0 && args.length % 2 === 1 && typeof args[args.length - 1] === "string") {
      this.setColor(args[args.length - 1]);
    }
    if (Array.isArray(args[0])) {
      if ((args[1] != null) && typeof args[1] === "string") {
        this.setColor(args[1]);
      }
      args = args[0];
    }
    this.context.globalAlpha = this.alpha;
    this.context.lineWidth = this.line_width;
    if (args.length < 4) {
      return;
    }
    len = Math.floor(args.length / 2);
    transform = this.initDrawOp(0, 0, false);
    this.context.beginPath();
    this.context.moveTo(args[0], -args[1]);
    for (i = j = 1, ref = len - 1; (1 <= ref ? j <= ref : j >= ref); i = 1 <= ref ? ++j : --j) {
      this.context.lineTo(args[i * 2], -args[i * 2 + 1]);
    }
    this.context.fill();
    if (transform) {
      return this.closeDrawOp();
    }
  }

  drawQuadCurve(args) {
    var index, len, transform;
    if (args.length > 0 && args.length % 2 === 1 && typeof args[args.length - 1] === "string") {
      this.setColor(args[args.length - 1]);
    }
    if (Array.isArray(args[0])) {
      if ((args[1] != null) && typeof args[1] === "string") {
        this.setColor(args[1]);
      }
      args = args[0];
    }
    this.context.globalAlpha = this.alpha;
    this.context.lineWidth = this.line_width;
    if (args.length < 4) {
      return;
    }
    len = Math.floor(args.length / 2);
    transform = this.initDrawOp(0, 0, false);
    this.context.beginPath();
    this.context.moveTo(args[0], -args[1]);
    index = 2;
    while (index <= args.length - 4) {
      this.context.quadraticCurveTo(args[index], -args[index + 1], args[index + 2], -args[index + 3]);
      index += 4;
    }
    this.context.stroke();
    if (transform) {
      return this.closeDrawOp();
    }
  }

  drawBezierCurve(args) {
    var index, len, transform;
    if (args.length > 0 && args.length % 2 === 1 && typeof args[args.length - 1] === "string") {
      this.setColor(args[args.length - 1]);
    }
    if (Array.isArray(args[0])) {
      if ((args[1] != null) && typeof args[1] === "string") {
        this.setColor(args[1]);
      }
      args = args[0];
    }
    this.context.globalAlpha = this.alpha;
    this.context.lineWidth = this.line_width;
    if (args.length < 4) {
      return;
    }
    len = Math.floor(args.length / 2);
    transform = this.initDrawOp(0, 0, false);
    this.context.beginPath();
    this.context.moveTo(args[0], -args[1]);
    index = 2;
    while (index <= args.length - 6) {
      this.context.bezierCurveTo(args[index], -args[index + 1], args[index + 2], -args[index + 3], args[index + 4], -args[index + 5]);
      index += 6;
    }
    this.context.stroke();
    if (transform) {
      return this.closeDrawOp();
    }
  }

  drawArc(x, y, radius, angle1, angle2, ccw, color) {
    this.setColor(color);
    this.context.globalAlpha = this.alpha;
    this.context.lineWidth = this.line_width;
    if (this.initDrawOp(x, -y)) {
      this.context.beginPath();
      this.context.arc(0, 0, radius, -angle1 / 180 * Math.PI, -angle2 / 180 * Math.PI, ccw);
      this.context.stroke();
      return this.closeDrawOp(x, -y);
    } else {
      this.context.beginPath();
      this.context.arc(x, -y, radius, -angle1 / 180 * Math.PI, -angle2 / 180 * Math.PI, ccw);
      return this.context.stroke();
    }
  }

  fillArc(x, y, radius, angle1, angle2, ccw, color) {
    this.setColor(color);
    this.context.globalAlpha = this.alpha;
    this.context.lineWidth = this.line_width;
    if (this.initDrawOp(x, -y)) {
      this.context.beginPath();
      this.context.arc(0, 0, radius, -angle1 / 180 * Math.PI, -angle2 / 180 * Math.PI, ccw);
      this.context.fill();
      return this.closeDrawOp(x, -y);
    } else {
      this.context.beginPath();
      this.context.arc(x, -y, radius, -angle1 / 180 * Math.PI, -angle2 / 180 * Math.PI, ccw);
      return this.context.fill();
    }
  }

  textWidth(text, size) {
    this.context.font = `${size}pt ${this.font}`;
    return this.context.measureText(text).width;
  }

  drawText(text, x, y, size, color) {
    var h, w;
    this.setColor(color);
    this.context.globalAlpha = this.alpha;
    this.context.font = `${size}pt ${this.font}`;
    this.context.textAlign = "center";
    this.context.textBaseline = "middle";
    w = this.context.measureText(text).width;
    h = size;
    if (this.initDrawOp(x, -y)) {
      this.context.fillText(text, 0 - this.anchor_x * w / 2, 0 + this.anchor_y * h / 2);
      return this.closeDrawOp(x, -y);
    } else {
      return this.context.fillText(text, x - this.anchor_x * w / 2, -y + this.anchor_y * h / 2);
    }
  }

  drawTextOutline(text, x, y, size, color) {
    var h, w;
    this.setColor(color);
    this.context.globalAlpha = this.alpha;
    this.context.font = `${size}pt ${this.font}`;
    this.context.lineWidth = this.line_width;
    this.context.textAlign = "center";
    this.context.textBaseline = "middle";
    w = this.context.measureText(text).width;
    h = size;
    if (this.initDrawOp(x, -y)) {
      this.context.strokeText(text, 0 - this.anchor_x * w / 2, 0 + this.anchor_y * h / 2);
      return this.closeDrawOp(x, -y);
    } else {
      return this.context.strokeText(text, x - this.anchor_x * w / 2, -y + this.anchor_y * h / 2);
    }
  }

  getSpriteFrame(sprite) {
    var dt, frame, s;
    frame = null;
    if (typeof sprite === "string") {
      s = this.runtime.sprites[sprite];
      if (s != null) {
        sprite = s;
      } else {
        s = sprite.split(".");
        if (s.length > 1) {
          sprite = this.runtime.sprites[s[0]];
          frame = s[1] | 0;
        }
      }
    } else if (sprite instanceof msImage) {
      return sprite.canvas || sprite.image;
    }
    if ((sprite == null) || !sprite.ready) {
      return null;
    }
    if (sprite.frames.length > 1) {
      if (frame == null) {
        dt = 1000 / sprite.fps;
        frame = Math.floor((Date.now() - sprite.animation_start) / dt) % sprite.frames.length;
      }
      if (frame >= 0 && frame < sprite.frames.length) {
        return sprite.frames[frame].canvas;
      } else {
        return sprite.frames[0].canvas;
      }
    } else if (sprite.frames[0] != null) {
      return sprite.frames[0].canvas;
    } else {
      return null;
    }
  }

  drawSprite(sprite, x, y, w, h) {
    var canvas;
    canvas = this.getSpriteFrame(sprite);
    if (canvas == null) {
      return;
    }
    if (w == null) {
      w = canvas.width;
    }
    if (!h) {
      h = w / canvas.width * canvas.height;
    }
    this.context.globalAlpha = this.alpha;
    this.context.imageSmoothingEnabled = !this.pixelated;
    if (this.initDrawOp(x, -y)) {
      this.context.drawImage(canvas, -w / 2 - this.anchor_x * w / 2, -h / 2 + this.anchor_y * h / 2, w, h);
      return this.closeDrawOp(x, -y);
    } else {
      return this.context.drawImage(canvas, x - w / 2 - this.anchor_x * w / 2, -y - h / 2 + this.anchor_y * h / 2, w, h);
    }
  }

  drawSpritePart(sprite, sx, sy, sw, sh, x, y, w, h) {
    var canvas;
    canvas = this.getSpriteFrame(sprite);
    if (canvas == null) {
      return;
    }
    if (w == null) {
      w = sw;
    }
    if (!h) {
      h = w / sw * sh;
    }
    this.context.globalAlpha = this.alpha;
    this.context.imageSmoothingEnabled = !this.pixelated;
    if (this.initDrawOp(x, -y)) {
      this.context.drawImage(canvas, sx, sy, sw, sh, -w / 2 - this.anchor_x * w / 2, -h / 2 + this.anchor_y * h / 2, w, h);
      return this.closeDrawOp(x, -y);
    } else {
      return this.context.drawImage(canvas, sx, sy, sw, sh, x - w / 2 - this.anchor_x * w / 2, -y - h / 2 + this.anchor_y * h / 2, w, h);
    }
  }

  drawMap(map, x, y, w, h) {
    if (typeof map === "string") {
      map = this.runtime.maps[map];
    }
    if ((map == null) || !map.ready) {
      return;
    }
    this.context.globalAlpha = this.alpha;
    this.context.imageSmoothingEnabled = !this.pixelated;
    if (this.initDrawOp(x, -y)) {
      map.draw(this.context, -w / 2 - this.anchor_x * w / 2, -h / 2 + this.anchor_y * h / 2, w, h);
      //@context.drawImage map.getCanvas(),-w/2-@anchor_x*w/2,-h/2+@anchor_y*h/2,w,h
      return this.closeDrawOp(x, -y);
    } else {
      return map.draw(this.context, x - w / 2 - this.anchor_x * w / 2, -y - h / 2 + this.anchor_y * h / 2, w, h);
    }
  }

  //@context.drawImage map.getCanvas(),x-w/2-@anchor_x*w/2,-y-h/2+@anchor_y*h/2,w,h
  resize() {
    var backingStoreRatio, ch, cw, devicePixelRatio, h, min, r, ratio, w;
    var parent = this.canvas.parentElement || document.getElementById("canvaswrapper");
    cw = (parent && parent.clientWidth > 0) ? parent.clientWidth : window.innerWidth;
    ch = (parent && parent.clientHeight > 0) ? parent.clientHeight : window.innerHeight;

    var aspect = (this.runtime.aspect || (window.resources && window.resources.aspect) || "16:9").toString().trim();
    min = aspect.startsWith(">");
    if (min) {
      aspect = aspect.substring(1);
    }
    ratio = {
      "4x3": 4 / 3,
      "16x9": 16 / 9,
      "2x1": 2 / 1,
      "1x1": 1 / 1,
      "16x10": 16 / 10,
      "4:3": 4 / 3,
      "16:9": 16 / 9,
      "2:1": 2 / 1,
      "1:1": 1 / 1,
      "16:10": 16 / 10
    }[aspect];
    if (ratio == null && aspect !== "free") {
      var match = aspect.match(/^(\d+(?:\.\d+)?)[x:](\d+(?:\.\d+)?)$/);
      if (match) {
        ratio = parseFloat(match[1]) / parseFloat(match[2]);
      }
    }

    var orientation = this.runtime.orientation || (window.resources && window.resources.orientation) || "landscape";
    if (orientation === "any") {
      orientation = cw > ch ? "landscape" : "portrait";
    }

    if (ratio != null) {
      if (min) {
        switch (orientation) {
          case "portrait":
            ratio = Math.max(ratio, ch / cw);
            break;
          case "landscape":
            ratio = Math.max(ratio, cw / ch);
            break;
          default:
            if (ch > cw) {
              ratio = Math.max(ratio, ch / cw);
            } else {
              ratio = Math.max(ratio, cw / ch);
            }
        }
      }
      switch (orientation) {
        case "portrait":
          r = Math.min(cw, ch / ratio) / cw;
          w = cw * r;
          h = cw * r * ratio;
          break;
        case "landscape":
          r = Math.min(cw / ratio, ch) / ch;
          w = ch * r * ratio;
          h = ch * r;
          break;
        default:
          if (cw > ch) {
            r = Math.min(cw / ratio, ch) / ch;
            w = ch * r * ratio;
            h = ch * r;
          } else {
            r = Math.min(cw, ch / ratio) / cw;
            w = cw * r;
            h = cw * r * ratio;
          }
      }
    } else {
      w = cw;
      h = ch;
    }
    this.canvas.style.width = Math.round(w) + "px";
    this.canvas.style.height = Math.round(h) + "px";
    if (parent && window.getComputedStyle(parent).display === "flex") {
      this.canvas.style["margin-top"] = "0px";
    } else {
      this.canvas.style["margin-top"] = Math.max(0, Math.round((ch - h) / 2)) + "px";
    }
    devicePixelRatio = window.devicePixelRatio || 1;
    backingStoreRatio = this.context.webkitBackingStorePixelRatio || this.context.mozBackingStorePixelRatio || this.context.msBackingStorePixelRatio || this.context.oBackingStorePixelRatio || this.context.backingStorePixelRatio || 1;
    this.ratio = devicePixelRatio / backingStoreRatio * Math.max(1, Math.min(2, this.supersampling));
    this.width = Math.round(w * this.ratio);
    this.height = Math.round(h * this.ratio);
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.initContext();
    return this.updateInterface();
  }

  startControl(element) {
    var backingStoreRatio, devicePixelRatio;
    this.element = element;
    document.addEventListener("touchstart", (event) => {
      return this.touchStart(event);
    });
    document.addEventListener("touchmove", (event) => {
      return this.touchMove(event);
    });
    document.addEventListener("touchend", (event) => {
      return this.touchRelease(event);
    });
    document.addEventListener("touchcancel", (event) => {
      return this.touchRelease(event);
    });
    document.addEventListener("mousedown", (event) => {
      return this.mouseDown(event);
    });
    document.addEventListener("mousemove", (event) => {
      return this.mouseMove(event);
    });
    document.addEventListener("mouseup", (event) => {
      return this.mouseUp(event);
    });
    document.addEventListener("mousewheel", (event) => {
      return this.mouseWheel(event);
    });
    document.addEventListener("DOMMouseScroll", (event) => {
      return this.mouseWheel(event);
    });
    devicePixelRatio = window.devicePixelRatio || 1;
    backingStoreRatio = this.context.webkitBackingStorePixelRatio || this.context.mozBackingStorePixelRatio || this.context.msBackingStorePixelRatio || this.context.oBackingStorePixelRatio || this.context.backingStorePixelRatio || 1;
    return this.ratio = devicePixelRatio / backingStoreRatio;
  }

  touchStart(event) {
    var b, i, j, min, ref, t, x, y;
    event.preventDefault();
    event.stopPropagation();
    b = this.canvas.getBoundingClientRect();
    for (i = j = 0, ref = event.changedTouches.length - 1; j <= ref; i = j += 1) {
      t = event.changedTouches[i];
      min = Math.min(this.canvas.clientWidth, this.canvas.clientHeight);
      x = (t.clientX - b.left - this.canvas.clientWidth / 2) / min * 200;
      y = (this.canvas.clientHeight / 2 - (t.clientY - b.top)) / min * 200;
      this.touches[t.identifier] = {
        x: x,
        y: y
      };
      this.mouse.x = x;
      this.mouse.y = y;
      this.mouse.pressed = 1;
      this.mouse.left = 1;
    }
    return false;
  }

  touchMove(event) {
    var b, i, j, min, ref, t, x, y;
    event.preventDefault();
    event.stopPropagation();
    b = this.canvas.getBoundingClientRect();
    for (i = j = 0, ref = event.changedTouches.length - 1; j <= ref; i = j += 1) {
      t = event.changedTouches[i];
      if (this.touches[t.identifier] != null) {
        min = Math.min(this.canvas.clientWidth, this.canvas.clientHeight);
        x = (t.clientX - b.left - this.canvas.clientWidth / 2) / min * 200;
        y = (this.canvas.clientHeight / 2 - (t.clientY - b.top)) / min * 200;
        this.touches[t.identifier].x = x;
        this.touches[t.identifier].y = y;
        this.mouse.x = x;
        this.mouse.y = y;
      }
    }
    return false;
  }

  touchRelease(event) {
    var i, j, ref, t, x, y;
    for (i = j = 0, ref = event.changedTouches.length - 1; j <= ref; i = j += 1) {
      t = event.changedTouches[i];
      x = (t.clientX - this.canvas.offsetLeft) * this.ratio;
      y = (t.clientY - this.canvas.offsetTop) * this.ratio;
      delete this.touches[t.identifier];
      this.mouse.pressed = 0;
      this.mouse.left = 0;
      this.mouse.right = 0;
      this.mouse.middle = 0;
    }
    return false;
  }

  mouseDown(event) {
    var b, min, x, y;
    this.mousepressed = true;
    b = this.canvas.getBoundingClientRect();
    min = Math.min(this.canvas.clientWidth, this.canvas.clientHeight);
    x = (event.clientX - b.left - this.canvas.clientWidth / 2) / min * 200;
    y = (this.canvas.clientHeight / 2 - (event.clientY - b.top)) / min * 200;
    this.touches["mouse"] = {
      x: x,
      y: y
    };
    //console.info @touches["mouse"]
    this.mouse.x = x;
    this.mouse.y = y;
    switch (event.button) {
      case 0:
        this.mouse.left = 1;
        break;
      case 1:
        this.mouse.middle = 1;
        break;
      case 2:
        this.mouse.right = 1;
    }
    this.mouse.pressed = Math.min(1, this.mouse.left + this.mouse.right + this.mouse.middle);
    return false;
  }

  mouseMove(event) {
    var b, min, x, y;
    event.preventDefault();
    b = this.canvas.getBoundingClientRect();
    min = Math.min(this.canvas.clientWidth, this.canvas.clientHeight);
    x = (event.clientX - b.left - this.canvas.clientWidth / 2) / min * 200;
    y = (this.canvas.clientHeight / 2 - (event.clientY - b.top)) / min * 200;
    if (this.touches["mouse"] != null) {
      this.touches["mouse"].x = x;
      this.touches["mouse"].y = y;
    }
    this.mouse.x = x;
    this.mouse.y = y;
    return false;
  }

  mouseUp(event) {
    var b, min, x, y;
    delete this.touches["mouse"];
    b = this.canvas.getBoundingClientRect();
    min = Math.min(this.canvas.clientWidth, this.canvas.clientHeight);
    x = (event.clientX - b.left - this.canvas.clientWidth / 2) / min * 200;
    y = (this.canvas.clientHeight / 2 - (event.clientY - b.top)) / min * 200;
    this.mouse.x = x;
    this.mouse.y = y;
    switch (event.button) {
      case 0:
        this.mouse.left = 0;
        break;
      case 1:
        this.mouse.middle = 0;
        break;
      case 2:
        this.mouse.right = 0;
    }
    this.mouse.pressed = Math.min(1, this.mouse.left + this.mouse.right + this.mouse.middle);
    return false;
  }

  mouseWheel(e) {
    if (e.wheelDelta < 0 || e.detail > 0) {
      return this.wheel = -1;
    } else {
      return this.wheel = 1;
    }
  }

  takePicture(callback) {
    return callback(this.canvas.toDataURL());
  }

};

this.AssetManager = class AssetManager {
  constructor(runtime) {
    this.runtime = runtime;
    this.interface = {
      loadFont: (font) => {
        return this.loadFont(font);
      },
      loadModel: (path, scene, callback) => {
        return this.loadModel(path, scene, callback);
      },
      loadImage: (path, callback) => {
        return this.loadImage(path, callback);
      },
      loadJSON: (path, callback) => {
        return this.loadJSON(path, callback);
      },
      loadText: (path, callback) => {
        return this.loadText(path, callback);
      },
      loadCSV: (path, callback) => {
        return this.loadCSV(path, callback);
      },
      loadMarkdown: (path, callback) => {
        return this.loadMarkdown(path, callback);
      },
      wasmInstance: (path, callback) => {
        return this.wasmInstance(path, callback);
      }
    };
  }

  getInterface() {
    return this.interface;
  }

  loadFont(font) {
    var err, file, name, split;
    if (typeof font !== "string") {
      return;
    }
    file = font.replace(/\//g, "-");
    split = file.split("-");
    name = split[split.length - 1];
    try {
      font = new FontFace(name, `url(assets/${file}.ttf)`);
      return font.load().then(() => {
        return document.fonts.add(font);
      });
    } catch (error) {
      err = error;
      return console.error(err);
    }
  }

  loadModel(path, scene, callback) {
    var loader;
    if (typeof BABYLON === "undefined" || BABYLON === null) {
      return;
    }
    loader = {
      ready: 0
    };
    if (this.runtime.assets[path] != null) {
      path = this.runtime.assets[path].file;
    } else {
      path = path.replace(/\//g, "-");
      path += ".glb";
    }
    return BABYLON.SceneLoader.LoadAssetContainer("", `assets/${path}`, scene, (container) => {
      loader.container = container;
      loader.ready = 1;
      if (callback) {
        return callback(container);
      }
    });
  }

  loadImage(path, callback) {
    var img, loader;
    loader = {
      ready: 0
    };
    if (this.runtime.assets[path] != null) {
      path = this.runtime.assets[path].file;
    }
    img = new Image;
    img.src = `assets/${path}`;
    img.onload = () => {
      var i;
      i = new msImage(img);
      loader.image = i;
      loader.ready = 1;
      if (callback) {
        return callback(i);
      }
    };
    return loader;
  }

  loadJSON(path, callback) {
    var loader;
    path = path.replace(/\//g, "-");
    path = `assets/${path}.json`;
    loader = {
      ready: 0
    };
    fetch(path).then((result) => {
      return result.json().then((data) => {
        loader.data = data;
        loader.ready = 1;
        if (callback) {
          return callback(data);
        }
      });
    });
    return loader;
  }

  loadText(path, callback, ext = "txt") {
    var loader;
    path = path.replace(/\//g, "-");
    path = `assets/${path}.${ext}`;
    loader = {
      ready: 0
    };
    fetch(path).then((result) => {
      return result.text().then((text) => {
        loader.text = text;
        loader.ready = 1;
        if (callback) {
          return callback(text);
        }
      });
    });
    return loader;
  }

  loadCSV(path, callback) {
    return this.loadText(path, callback, "csv");
  }

  loadMarkdown(path, callback) {
    return this.loadText(path, callback, "md");
  }

  wasmInstance(path, callback) {
    var loader;
    path = path.replace(/\//g, "-");
    path = `assets/${path}.wasm`;
    loader = {
      ready: 0
    };
    fetch(path).then((response) => {
      return response.arrayBuffer().then((buffer) => {
        return WebAssembly.instantiate(buffer).then((result) => {
          loader.instance = result.instance;
          loader.ready = 1;
          if (callback) {
            return callback(loader.instance);
          }
        });
      });
    });
    return loader;
  }

};

this.Keyboard = (function() {
  function Keyboard() {
    document.addEventListener("keydown", (function(_this) {
      return function(event) {
        return _this.keydown(event);
      };
    })(this));
    document.addEventListener("keyup", (function(_this) {
      return function(event) {
        return _this.keyup(event);
      };
    })(this));
    this.keyboard = {
      press: {},
      release: {}
    };
    this.previous = {};
  }

  Keyboard.prototype.convertCode = function(code) {
    var c, i, j, low, ref, res;
    res = "";
    low = false;
    for (i = j = 0, ref = code.length - 1; 0 <= ref ? j <= ref : j >= ref; i = 0 <= ref ? ++j : --j) {
      c = code.charAt(i);
      if (c === c.toUpperCase() && low) {
        res += "_";
        low = false;
      } else {
        low = true;
      }
      res += c.toUpperCase();
    }
    return res;
  };

  Keyboard.prototype.keydown = function(event) {
    var code, key;
    if (!event.altKey && !event.ctrlKey && !event.metaKey && !/Escape|(F\d+)/.test(event.key)) {
      event.preventDefault();
    }
    code = event.code;
    key = event.key;
    this.keyboard[this.convertCode(code)] = 1;
    this.keyboard[key.toUpperCase()] = 1;
    return this.updateDirectional();
  };

  Keyboard.prototype.keyup = function(event) {
    var code, key;
    code = event.code;
    key = event.key;
    this.keyboard[this.convertCode(code)] = 0;
    this.keyboard[key.toUpperCase()] = 0;
    return this.updateDirectional();
  };

  Keyboard.prototype.updateDirectional = function() {
    this.keyboard.UP = this.keyboard.KEY_W || this.keyboard.ARROW_UP;
    this.keyboard.DOWN = this.keyboard.KEY_S || this.keyboard.ARROW_DOWN;
    this.keyboard.LEFT = this.keyboard.KEY_A || this.keyboard.ARROW_LEFT;
    return this.keyboard.RIGHT = this.keyboard.KEY_D || this.keyboard.ARROW_RIGHT;
  };

  Keyboard.prototype.update = function() {
    var key;
    for (key in this.keyboard.press) {
      this.keyboard.press[key] = 0;
    }
    for (key in this.keyboard.release) {
      this.keyboard.release[key] = 0;
    }
    for (key in this.previous) {
      if (this.previous[key] && !this.keyboard[key]) {
        this.keyboard.release[key] = 1;
      }
    }
    for (key in this.keyboard) {
      if (key === "press" || key === "release") {
        continue;
      }
      if (this.keyboard[key] && !this.previous[key]) {
        this.keyboard.press[key] = 1;
      }
    }
    for (key in this.previous) {
      this.previous[key] = 0;
    }
    for (key in this.keyboard) {
      if (key === "press" || key === "release") {
        continue;
      }
      this.previous[key] = this.keyboard[key];
    }
  };

  Keyboard.prototype.reset = function() {
    var key;
    for (key in this.keyboard) {
      if (key === "press" || key === "release") {
        continue;
      }
      this.keyboard[key] = 0;
    }
  };

  return Keyboard;

})();

this.Gamepad = (function() {
  function Gamepad(listener, index) {
    var error, pads;
    this.listener = listener;
    this.index = index != null ? index : 0;
    try {
      if (navigator.getGamepads != null) {
        pads = navigator.getGamepads();
        if (this.index < pads.length && (pads[this.index] != null)) {
          this.pad = pads[this.index];
        }
      }
    } catch (error1) {
      error = error1;
      console.error(error);
    }
    this.buttons_map = {
      0: "A",
      1: "B",
      2: "X",
      3: "Y",
      4: "LB",
      5: "RB",
      8: "VIEW",
      9: "MENU",
      10: "LS",
      11: "RS",
      12: "DPAD_UP",
      13: "DPAD_DOWN",
      14: "DPAD_LEFT",
      15: "DPAD_RIGHT"
    };
    this.triggers_map = {
      6: "LT",
      7: "RT"
    };
    this.status = {
      press: {},
      release: {}
    };
    this.previous = {
      global: {},
      0: {},
      1: {},
      2: {},
      3: {}
    };
  }

  Gamepad.prototype.update = function() {
    var angle, err, i, j, k, key, l, len, len1, len2, m, n, o, pad, pad_count, pads, r, ref, ref1, ref2, ref3, ref4, ref5, ref6, value, x, y;
    try {
      pads = navigator.getGamepads();
    } catch (error1) {
      err = error1;
      return;
    }
    pad_count = 0;
    for (i = j = 0, len = pads.length; j < len; i = ++j) {
      pad = pads[i];
      if (pad == null) {
        break;
      }
      pad_count++;
      if (!this.status[i]) {
        this.status[i] = {
          press: {},
          release: {}
        };
      }
      ref = this.buttons_map;
      for (key in ref) {
        value = ref[key];
        if (pad.buttons[key] != null) {
          this.status[i][value] = pad.buttons[key].pressed ? 1 : 0;
        }
      }
      ref1 = this.triggers_map;
      for (key in ref1) {
        value = ref1[key];
        if (pad.buttons[key] != null) {
          this.status[i][value] = pad.buttons[key].value;
        }
      }
      if (pad.axes.length >= 2) {
        x = pad.axes[0];
        y = -pad.axes[1];
        r = Math.sqrt(x * x + y * y);
        angle = Math.floor(((Math.atan2(y, x) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * 360);
        this.status[i].LEFT_STICK_ANGLE = angle;
        this.status[i].LEFT_STICK_AMOUNT = r;
        this.status[i].LEFT_STICK_UP = y > .5;
        this.status[i].LEFT_STICK_DOWN = y < -.5;
        this.status[i].LEFT_STICK_LEFT = x < -.5;
        this.status[i].LEFT_STICK_RIGHT = x > .5;
      }
      if (pad.axes.length >= 4) {
        x = pad.axes[2];
        y = -pad.axes[3];
        r = Math.sqrt(x * x + y * y);
        angle = Math.floor(((Math.atan2(y, x) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * 360);
        this.status[i].RIGHT_STICK_ANGLE = angle;
        this.status[i].RIGHT_STICK_AMOUNT = r;
        this.status[i].RIGHT_STICK_UP = y > .5;
        this.status[i].RIGHT_STICK_DOWN = y < -.5;
        this.status[i].RIGHT_STICK_LEFT = x < -.5;
        this.status[i].RIGHT_STICK_RIGHT = x > .5;
      }
    }
    ref2 = this.buttons_map;
    for (key in ref2) {
      value = ref2[key];
      this.status[value] = 0;
      for (k = 0, len1 = pads.length; k < len1; k++) {
        pad = pads[k];
        if (pad == null) {
          break;
        }
        if ((pad.buttons[key] != null) && pad.buttons[key].pressed) {
          this.status[value] = 1;
        }
      }
    }
    ref3 = this.triggers_map;
    for (key in ref3) {
      value = ref3[key];
      this.status[value] = 0;
      for (l = 0, len2 = pads.length; l < len2; l++) {
        pad = pads[l];
        if (pad == null) {
          break;
        }
        if (pad.buttons[key] != null) {
          this.status[value] = pad.buttons[key].value;
        }
      }
    }
    this.status.UP = 0;
    this.status.DOWN = 0;
    this.status.LEFT = 0;
    this.status.RIGHT = 0;
    this.status.LEFT_STICK_UP = 0;
    this.status.LEFT_STICK_DOWN = 0;
    this.status.LEFT_STICK_LEFT = 0;
    this.status.LEFT_STICK_RIGHT = 0;
    this.status.RIGHT_STICK_UP = 0;
    this.status.RIGHT_STICK_DOWN = 0;
    this.status.RIGHT_STICK_LEFT = 0;
    this.status.RIGHT_STICK_RIGHT = 0;
    this.status.LEFT_STICK_ANGLE = 0;
    this.status.LEFT_STICK_AMOUNT = 0;
    this.status.RIGHT_STICK_ANGLE = 0;
    this.status.RIGHT_STICK_AMOUNT = 0;
    this.status.RT = 0;
    this.status.LT = 0;
    for (i = m = 0, ref4 = pad_count - 1; m <= ref4; i = m += 1) {
      this.status[i].UP = this.status[i].DPAD_UP || this.status[i].LEFT_STICK_UP || this.status[i].RIGHT_STICK_UP;
      this.status[i].DOWN = this.status[i].DPAD_DOWN || this.status[i].LEFT_STICK_DOWN || this.status[i].RIGHT_STICK_DOWN;
      this.status[i].LEFT = this.status[i].DPAD_LEFT || this.status[i].LEFT_STICK_LEFT || this.status[i].RIGHT_STICK_LEFT;
      this.status[i].RIGHT = this.status[i].DPAD_RIGHT || this.status[i].LEFT_STICK_RIGHT || this.status[i].RIGHT_STICK_RIGHT;
      if (this.status[i].UP) {
        this.status.UP = 1;
      }
      if (this.status[i].DOWN) {
        this.status.DOWN = 1;
      }
      if (this.status[i].LEFT) {
        this.status.LEFT = 1;
      }
      if (this.status[i].RIGHT) {
        this.status.RIGHT = 1;
      }
      if (this.status[i].LEFT_STICK_UP) {
        this.status.LEFT_STICK_UP = 1;
      }
      if (this.status[i].LEFT_STICK_DOWN) {
        this.status.LEFT_STICK_DOWN = 1;
      }
      if (this.status[i].LEFT_STICK_LEFT) {
        this.status.LEFT_STICK_LEFT = 1;
      }
      if (this.status[i].LEFT_STICK_RIGHT) {
        this.status.LEFT_STICK_RIGHT = 1;
      }
      if (this.status[i].RIGHT_STICK_UP) {
        this.status.RIGHT_STICK_UP = 1;
      }
      if (this.status[i].RIGHT_STICK_DOWN) {
        this.status.RIGHT_STICK_DOWN = 1;
      }
      if (this.status[i].RIGHT_STICK_LEFT) {
        this.status.RIGHT_STICK_LEFT = 1;
      }
      if (this.status[i].RIGHT_STICK_RIGHT) {
        this.status.RIGHT_STICK_RIGHT = 1;
      }
      if (this.status[i].LT) {
        this.status.LT = this.status[i].LT;
      }
      if (this.status[i].RT) {
        this.status.RT = this.status[i].RT;
      }
      if (this.status[i].LEFT_STICK_AMOUNT > this.status.LEFT_STICK_AMOUNT) {
        this.status.LEFT_STICK_AMOUNT = this.status[i].LEFT_STICK_AMOUNT;
        this.status.LEFT_STICK_ANGLE = this.status[i].LEFT_STICK_ANGLE;
      }
      if (this.status[i].RIGHT_STICK_AMOUNT > this.status.RIGHT_STICK_AMOUNT) {
        this.status.RIGHT_STICK_AMOUNT = this.status[i].RIGHT_STICK_AMOUNT;
        this.status.RIGHT_STICK_ANGLE = this.status[i].RIGHT_STICK_ANGLE;
      }
    }
    for (i = n = ref5 = pad_count; n <= 3; i = n += 1) {
      delete this.status[i];
    }
    this.count = pad_count;
    this.updateChanges(this.status, this.previous.global);
    for (i = o = 0, ref6 = pad_count - 1; o <= ref6; i = o += 1) {
      this.updateChanges(this.status[i], this.previous[i]);
    }
  };

  Gamepad.prototype.updateChanges = function(current, previous) {
    var key;
    for (key in current.press) {
      current.press[key] = 0;
    }
    for (key in current.release) {
      current.release[key] = 0;
    }
    for (key in previous) {
      if (previous[key] && !current[key]) {
        current.release[key] = 1;
      }
    }
    for (key in current) {
      if (key === "press" || key === "release") {
        continue;
      }
      if (current[key] && !previous[key]) {
        current.press[key] = 1;
      }
    }
    for (key in previous) {
      previous[key] = 0;
    }
    for (key in current) {
      if (key === "press" || key === "release") {
        continue;
      }
      previous[key] = current[key];
    }
  };

  return Gamepad;

})();

this.Sprite = class Sprite {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.name = "";
    this.frames = [];
    this.animation_start = 0;
    this.fps = 5;
    if (this.width > 0 && this.height > 0) {
      this.frames.push(new msImage(this.width, this.height));
      this.ready = 1;
    }
  }

  setFPS(fps) {
    var dt, frame;
    dt = 1000 / this.fps;
    frame = ((Date.now() - this.animation_start) / dt) % this.frames.length;
    this.fps = fps;
    dt = 1000 / fps;
    this.animation_start = Date.now() - frame * dt;
    return fps;
  }

  setFrame(f) {
    return this.animation_start = Date.now() - 1000 / this.fps * f;
  }

  getFrame() {
    var dt;
    dt = 1000 / this.fps;
    return Math.floor((Date.now() - this.animation_start) / dt) % this.frames.length;
  }

};

this.LoadSprite = function(url, properties, loaded) {
  var img, sprite;
  sprite = new Sprite(0, 0);
  sprite.ready = 0;
  img = new Image;
  if (!url.startsWith("data:") && location.protocol !== "file:") {
    img.crossOrigin = "Anonymous";
  }
  img.onload = () => {
    var frame, i, j, numframes, ref;
    sprite.ready = true;
    if (img.width > 0 && img.height > 0) {
      numframes = 1;
      if ((properties != null) && (properties.frames != null)) {
        numframes = properties.frames;
      }
      if (properties.fps != null) {
        sprite.fps = properties.fps;
      }
      sprite.width = img.width;
      sprite.height = Math.round(img.height / numframes);
      sprite.frames = [];
      for (i = j = 0, ref = numframes - 1; (0 <= ref ? j <= ref : j >= ref); i = 0 <= ref ? ++j : --j) {
        frame = new msImage(sprite.width, sprite.height);
        frame.initContext();
        frame.context.drawImage(img, 0, -i * sprite.height);
        sprite.frames.push(frame);
      }
      sprite.ready = true;
    }
    if (loaded != null) {
      return loaded();
    }
  };
  img.onerror = (e) => {
    console.warn("Failed to load sprite: " + url, e);
    sprite.ready = 1;
    if (loaded != null) {
      return loaded();
    }
  };
  img.src = url;
  return sprite;
};

this.UpdateSprite = function(sprite, img, properties) {
  var frame, i, j, numframes, ref;
  if (img.width > 0 && img.height > 0) {
    numframes = 1;
    if ((properties != null) && (properties.frames != null)) {
      numframes = properties.frames;
    }
    if ((properties != null) && (properties.fps != null)) {
      sprite.fps = properties.fps;
    }
    sprite.width = img.width;
    sprite.height = Math.round(img.height / numframes);
    sprite.frames = [];
    for (i = j = 0, ref = numframes - 1; (0 <= ref ? j <= ref : j >= ref); i = 0 <= ref ? ++j : --j) {
      frame = new msImage(sprite.width, sprite.height);
      frame.initContext();
      frame.context.drawImage(img, 0, -i * sprite.height);
      sprite.frames.push(frame);
    }
    return sprite.ready = true;
  }
};

var b, j, len1, ref;

this.msImage = (function() {
  class msImage {
    constructor(width, height, centered = false) {
      this.width = width;
      this.height = height;
      this.centered = centered;
      this.class = msImage;
      if (this.width instanceof Image) {
        this.image = this.width;
        this.width = this.image.width;
        this.height = this.image.height;
      } else if (this.width instanceof HTMLCanvasElement) {
        this.canvas = this.width;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
      } else {
        this.canvas = document.createElement("canvas");
        this.canvas.width = this.width = Math.round(this.width);
        this.canvas.height = this.height = Math.round(this.height);
      }
    }

    setRGB(x, y, r, g, b) {
      this.initContext();
      if (this.pixeldata == null) {
        this.pixeldata = this.context.getImageData(0, 0, 1, 1);
      }
      if (r.R != null) {
        this.pixeldata.data[0] = r.R;
        this.pixeldata.data[1] = r.G;
        this.pixeldata.data[2] = r.B;
      } else {
        this.pixeldata.data[0] = r;
        this.pixeldata.data[1] = g;
        this.pixeldata.data[2] = b;
      }
      this.pixeldata.data[3] = 255;
      return this.context.putImageData(this.pixeldata, x, y);
    }

    setRGBA(x, y, r, g, b, a) {
      this.initContext();
      if (this.pixeldata == null) {
        this.pixeldata = this.context.getImageData(0, 0, 1, 1);
      }
      if (r.R != null) {
        this.pixeldata.data[0] = r.R;
        this.pixeldata.data[1] = r.G;
        this.pixeldata.data[2] = r.B;
        this.pixeldata.data[3] = r.A != null ? r.A : 255;
      } else {
        this.pixeldata.data[0] = r;
        this.pixeldata.data[1] = g;
        this.pixeldata.data[2] = b;
        this.pixeldata.data[3] = a;
      }
      return this.context.putImageData(this.pixeldata, x, y);
    }

    getRGB(x, y, result = {}) {
      var d;
      this.initContext();
      d = this.context.getImageData(x, y, 1, 1);
      result.R = d.data[0];
      result.G = d.data[1];
      result.B = d.data[2];
      return result;
    }

    getRGBA(x, y, result = {}) {
      var d;
      this.initContext();
      d = this.context.getImageData(x, y, 1, 1);
      result.R = d.data[0];
      result.G = d.data[1];
      result.B = d.data[2];
      result.A = d.data[3];
      return result;
    }

    initContext() {
      if (this.context != null) {
        return;
      }
      if ((this.canvas == null) && (this.image != null)) {
        this.canvas = document.createElement("canvas");
        this.canvas.width = this.image.width;
        this.canvas.height = this.image.height;
        this.context = this.canvas.getContext("2d");
        this.context.drawImage(this.image, 0, 0);
        this.image = null;
      }
      this.alpha = 1;
      this.pixelated = 1;
      this.line_width = 1;
      this.context = this.canvas.getContext("2d");
      this.context.lineCap = "round";
      if (this.centered) {
        this.translation_x = this.width / 2;
        this.translation_y = this.height / 2;
        this.rotation = 0;
        this.scale_x = 1;
        this.scale_y = -1;
        this.image_transform = true;
        this.anchor_x = 0;
        this.anchor_y = 0;
        this.object_scale_y = -1;
      } else {
        this.translation_x = 0;
        this.translation_y = 0;
        this.rotation = 0;
        this.scale_x = 1;
        this.scale_y = 1;
        this.image_transform = false;
        this.anchor_x = -1;
        this.anchor_y = 1;
        this.object_scale_y = 1;
      }
      this.object_rotation = 0;
      this.object_scale_x = 1;
      if (this.font == null) {
        return this.font = "BitCell";
      }
    }

    clear(color) {
      var blending_save, c, s;
      this.initContext();
      c = this.context.fillStyle;
      s = this.context.strokeStyle;
      blending_save = this.context.globalCompositeOperation;
      this.context.globalAlpha = 1;
      this.context.globalCompositeOperation = "source-over";
      if (color != null) {
        this.setColor(color);
      } else {
        this.context.fillStyle = "#000";
      }
      this.context.fillRect(0, 0, this.width, this.height);
      this.context.fillStyle = c;
      this.context.strokeStyle = s;
      return this.context.globalCompositeOperation = blending_save;
    }

    setColor(color) {
      this.initContext();
      if (color == null) {
        return;
      }
      if (typeof color === "string") {
        this.context.fillStyle = color;
        return this.context.strokeStyle = color;
      }
    }

    setAlpha(alpha) {
      this.initContext();
      return this.alpha = alpha;
    }

    setPixelated(pixelated) {
      this.initContext();
      return this.pixelated = pixelated;
    }

    setBlending(blending) {
      this.initContext();
      blending = BLENDING_MODES[blending || "normal"] || "source-over";
      return this.context.globalCompositeOperation = blending;
    }

    setLineWidth(line_width) {
      this.initContext();
      return this.line_width = line_width;
    }

    setLineDash(dash) {
      this.initContext();
      if (!Array.isArray(dash)) {
        return this.context.setLineDash([]);
      } else {
        return this.context.setLineDash(dash);
      }
    }

    setLinearGradient(x1, y1, x2, y2, c1, c2) {
      var grd;
      this.initContext();
      grd = this.context.createLinearGradient(x1, y1, x2, y2);
      grd.addColorStop(0, c1);
      grd.addColorStop(1, c2);
      this.context.fillStyle = grd;
      return this.context.strokeStyle = grd;
    }

    setRadialGradient(x, y, radius, c1, c2) {
      var grd;
      this.initContext();
      grd = this.context.createRadialGradient(x, y, 0, x, y, radius);
      grd.addColorStop(0, c1);
      grd.addColorStop(1, c2);
      this.context.fillStyle = grd;
      return this.context.strokeStyle = grd;
    }

    setFont(font) {
      this.font = font || "Verdana";
      return this.loadFont(this.font);
    }

    loadFont(font) {
      return window.player.runtime.screen.loadFont(font);
    }

    isFontReady(font = this.font) {
      return window.player.runtime.screen.isFontReady(font);
    }

    setTranslation(translation_x, translation_y) {
      this.initContext();
      this.translation_x = translation_x;
      this.translation_y = translation_y;
      if (!isFinite(this.translation_x)) {
        this.translation_x = 0;
      }
      if (!isFinite(this.translation_y)) {
        this.translation_y = 0;
      }
      return this.updateScreenTransform();
    }

    setScale(scale_x, scale_y) {
      this.initContext();
      this.scale_x = scale_x;
      this.scale_y = scale_y;
      if (!isFinite(this.scale_x) || this.scale_x === 0) {
        this.scale_x = 1;
      }
      if (!isFinite(this.scale_y) || this.scale_y === 0) {
        this.scale_y = 1;
      }
      return this.updateScreenTransform();
    }

    setRotation(rotation) {
      this.initContext();
      this.rotation = rotation;
      if (!isFinite(this.rotation)) {
        this.rotation = 0;
      }
      return this.updateScreenTransform();
    }

    updateScreenTransform() {
      return this.image_transform = this.translation_x !== 0 || this.translation_y !== 0 || this.scale_x !== 1 || this.scale_y !== 1 || this.rotation !== 0;
    }

    setDrawAnchor(anchor_x, anchor_y) {
      this.initContext();
      this.anchor_x = anchor_x;
      this.anchor_y = anchor_y;
      if (typeof this.anchor_x !== "number") {
        this.anchor_x = 0;
      }
      if (typeof this.anchor_y !== "number") {
        return this.anchor_y = 0;
      }
    }

    setDrawRotation(object_rotation) {
      this.initContext();
      return this.object_rotation = object_rotation;
    }

    setDrawScale(object_scale_x, object_scale_y = object_scale_x) {
      this.initContext();
      this.object_scale_x = object_scale_x;
      return this.object_scale_y = object_scale_y;
    }

    initDrawOp(x, y, object_transform = true) {
      var res;
      res = false;
      if (this.image_transform) {
        this.context.save();
        res = true;
        this.context.translate(this.translation_x, this.translation_y);
        this.context.scale(this.scale_x, this.scale_y);
        this.context.rotate(this.rotation / 180 * Math.PI);
        this.context.translate(x, y);
      }
      if (object_transform && (this.object_rotation !== 0 || this.object_scale_x !== 1 || this.object_scale_y !== 1)) {
        if (!res) {
          this.context.save();
          res = true;
          this.context.translate(x, y);
        }
        if (this.object_rotation !== 0) {
          this.context.rotate(this.object_rotation / 180 * Math.PI);
        }
        if (this.object_scale_x !== 1 || this.object_scale_y !== 1) {
          this.context.scale(this.object_scale_x, this.object_scale_y);
        }
      }
      return res;
    }

    closeDrawOp(x, y) {
      return this.context.restore();
    }

    fillRect(x, y, w, h, color) {
      this.initContext();
      this.setColor(color);
      this.context.globalAlpha = this.alpha;
      if (this.initDrawOp(x, y)) {
        this.context.fillRect(-w / 2 - this.anchor_x * w / 2, -h / 2 + this.anchor_y * h / 2, w, h);
        return this.closeDrawOp(x, y);
      } else {
        return this.context.fillRect(x - w / 2 - this.anchor_x * w / 2, y - h / 2 + this.anchor_y * h / 2, w, h);
      }
    }

    fillRoundRect(x, y, w, h, round = 10, color) {
      this.initContext();
      this.setColor(color);
      this.context.globalAlpha = this.alpha;
      if (this.initDrawOp(x, y)) {
        this.context.fillRoundRect(-w / 2 - this.anchor_x * w / 2, -h / 2 + this.anchor_y * h / 2, w, h, round);
        return this.closeDrawOp(x, y);
      } else {
        return this.context.fillRoundRect(x - w / 2 - this.anchor_x * w / 2, y - h / 2 + this.anchor_y * h / 2, w, h, round);
      }
    }

    fillRound(x, y, w, h, color) {
      this.initContext();
      this.setColor(color);
      this.context.globalAlpha = this.alpha;
      w = Math.abs(w);
      h = Math.abs(h);
      if (this.initDrawOp(x, y)) {
        this.context.beginPath();
        this.context.ellipse(-this.anchor_x * w / 2, 0 + this.anchor_y * h / 2, w / 2, h / 2, 0, 0, Math.PI * 2, false);
        this.context.fill();
        return this.closeDrawOp(x, y);
      } else {
        this.context.beginPath();
        this.context.ellipse(x - this.anchor_x * w / 2, y + this.anchor_y * h / 2, w / 2, h / 2, 0, 0, Math.PI * 2, false);
        return this.context.fill();
      }
    }

    drawRect(x, y, w, h, color) {
      this.initContext();
      this.setColor(color);
      this.context.globalAlpha = this.alpha;
      this.context.lineWidth = this.line_width;
      if (this.initDrawOp(x, y)) {
        this.context.strokeRect(-w / 2 - this.anchor_x * w / 2, -h / 2 + this.anchor_y * h / 2, w, h);
        return this.closeDrawOp(x, y);
      } else {
        return this.context.strokeRect(x - w / 2 - this.anchor_x * w / 2, y - h / 2 + this.anchor_y * h / 2, w, h);
      }
    }

    drawRoundRect(x, y, w, h, round = 10, color) {
      this.initContext();
      this.setColor(color);
      this.context.globalAlpha = this.alpha;
      this.context.lineWidth = this.line_width;
      if (this.initDrawOp(x, y)) {
        this.context.strokeRoundRect(-w / 2 - this.anchor_x * w / 2, -h / 2 + this.anchor_y * h / 2, w, h, round);
        return this.closeDrawOp(x, y);
      } else {
        return this.context.strokeRoundRect(x - w / 2 - this.anchor_x * w / 2, y - h / 2 + this.anchor_y * h / 2, w, h, round);
      }
    }

    drawRound(x, y, w, h, color) {
      this.initContext();
      this.setColor(color);
      this.context.globalAlpha = this.alpha;
      this.context.lineWidth = this.line_width;
      w = Math.abs(w);
      h = Math.abs(h);
      if (this.initDrawOp(x, y)) {
        this.context.beginPath();
        this.context.ellipse(0 - this.anchor_x * w / 2, 0 + this.anchor_y * h / 2, w / 2, h / 2, 0, 0, Math.PI * 2, false);
        this.context.stroke();
        return this.closeDrawOp(x, y);
      } else {
        this.context.beginPath();
        this.context.ellipse(x - this.anchor_x * w / 2, y + this.anchor_y * h / 2, w / 2, h / 2, 0, 0, Math.PI * 2, false);
        return this.context.stroke();
      }
    }

    drawLine(x1, y1, x2, y2, color) {
      var transform;
      this.initContext();
      this.setColor(color);
      this.context.globalAlpha = this.alpha;
      this.context.lineWidth = this.line_width;
      transform = this.initDrawOp(0, 0, false);
      this.context.beginPath();
      this.context.moveTo(x1, y1);
      this.context.lineTo(x2, y2);
      this.context.stroke();
      if (transform) {
        return this.closeDrawOp();
      }
    }

    drawPolyline() {
      var args, i, j, len, ref, transform;
      args = arguments;
      this.initContext();
      if (args.length > 0 && args.length % 2 === 1 && typeof args[args.length - 1] === "string") {
        this.setColor(args[args.length - 1]);
      }
      if (Array.isArray(args[0])) {
        if ((args[1] != null) && typeof args[1] === "string") {
          this.setColor(args[1]);
        }
        args = args[0];
      }
      this.context.globalAlpha = this.alpha;
      this.context.lineWidth = this.line_width;
      if (args.length < 4) {
        return;
      }
      len = Math.floor(args.length / 2);
      transform = this.initDrawOp(0, 0, false);
      this.context.beginPath();
      this.context.moveTo(args[0], args[1]);
      for (i = j = 1, ref = len - 1; (1 <= ref ? j <= ref : j >= ref); i = 1 <= ref ? ++j : --j) {
        this.context.lineTo(args[i * 2], args[i * 2 + 1]);
      }
      this.context.stroke();
      if (transform) {
        return this.closeDrawOp();
      }
    }

    drawPolygon() {
      var args, i, j, len, ref, transform;
      args = arguments;
      this.initContext();
      if (args.length > 0 && args.length % 2 === 1 && typeof args[args.length - 1] === "string") {
        this.setColor(args[args.length - 1]);
      }
      if (Array.isArray(args[0])) {
        if ((args[1] != null) && typeof args[1] === "string") {
          this.setColor(args[1]);
        }
        args = args[0];
      }
      this.context.globalAlpha = this.alpha;
      this.context.lineWidth = this.line_width;
      if (args.length < 4) {
        return;
      }
      len = Math.floor(args.length / 2);
      transform = this.initDrawOp(0, 0, false);
      this.context.beginPath();
      this.context.moveTo(args[0], args[1]);
      for (i = j = 1, ref = len - 1; (1 <= ref ? j <= ref : j >= ref); i = 1 <= ref ? ++j : --j) {
        this.context.lineTo(args[i * 2], args[i * 2 + 1]);
      }
      this.context.closePath();
      this.context.stroke();
      if (transform) {
        return this.closeDrawOp();
      }
    }

    fillPolygon() {
      var args, i, j, len, ref, transform;
      args = arguments;
      this.initContext();
      if (args.length > 0 && args.length % 2 === 1 && typeof args[args.length - 1] === "string") {
        this.setColor(args[args.length - 1]);
      }
      if (Array.isArray(args[0])) {
        if ((args[1] != null) && typeof args[1] === "string") {
          this.setColor(args[1]);
        }
        args = args[0];
      }
      this.context.globalAlpha = this.alpha;
      this.context.lineWidth = this.line_width;
      if (args.length < 4) {
        return;
      }
      len = Math.floor(args.length / 2);
      transform = this.initDrawOp(0, 0, false);
      this.context.beginPath();
      this.context.moveTo(args[0], args[1]);
      for (i = j = 1, ref = len - 1; (1 <= ref ? j <= ref : j >= ref); i = 1 <= ref ? ++j : --j) {
        this.context.lineTo(args[i * 2], args[i * 2 + 1]);
      }
      this.context.fill();
      if (transform) {
        return this.closeDrawOp();
      }
    }

    drawQuadCurve() {
      var args, index, len, transform;
      args = arguments;
      this.initContext();
      if (args.length > 0 && args.length % 2 === 1 && typeof args[args.length - 1] === "string") {
        this.setColor(args[args.length - 1]);
      }
      if (Array.isArray(args[0])) {
        if ((args[1] != null) && typeof args[1] === "string") {
          this.setColor(args[1]);
        }
        args = args[0];
      }
      this.context.globalAlpha = this.alpha;
      this.context.lineWidth = this.line_width;
      if (args.length < 4) {
        return;
      }
      len = Math.floor(args.length / 2);
      transform = this.initDrawOp(0, 0, false);
      this.context.beginPath();
      this.context.moveTo(args[0], args[1]);
      index = 2;
      while (index <= args.length - 4) {
        this.context.quadraticCurveTo(args[index], args[index + 1], args[index + 2], args[index + 3]);
        index += 4;
      }
      this.context.stroke();
      if (transform) {
        return this.closeDrawOp();
      }
    }

    drawBezierCurve() {
      var args, index, len, transform;
      args = arguments;
      this.initContext();
      if (args.length > 0 && args.length % 2 === 1 && typeof args[args.length - 1] === "string") {
        this.setColor(args[args.length - 1]);
      }
      if (Array.isArray(args[0])) {
        if ((args[1] != null) && typeof args[1] === "string") {
          this.setColor(args[1]);
        }
        args = args[0];
      }
      this.context.globalAlpha = this.alpha;
      this.context.lineWidth = this.line_width;
      if (args.length < 4) {
        return;
      }
      len = Math.floor(args.length / 2);
      transform = this.initDrawOp(0, 0, false);
      this.context.beginPath();
      this.context.moveTo(args[0], args[1]);
      index = 2;
      while (index <= args.length - 6) {
        this.context.bezierCurveTo(args[index], args[index + 1], args[index + 2], args[index + 3], args[index + 4], args[index + 5]);
        index += 6;
      }
      this.context.stroke();
      if (transform) {
        return this.closeDrawOp();
      }
    }

    drawArc(x, y, radius, angle1, angle2, ccw, color) {
      this.initContext();
      this.setColor(color);
      this.context.globalAlpha = this.alpha;
      this.context.lineWidth = this.line_width;
      if (this.initDrawOp(x, y)) {
        this.context.beginPath();
        this.context.arc(0, 0, radius, angle1 / 180 * Math.PI, angle2 / 180 * Math.PI, ccw);
        this.context.stroke();
        return this.closeDrawOp(x, -y);
      } else {
        this.context.beginPath();
        this.context.arc(x, y, radius, angle1 / 180 * Math.PI, angle2 / 180 * Math.PI, ccw);
        return this.context.stroke();
      }
    }

    fillArc(x, y, radius, angle1, angle2, ccw, color) {
      this.initContext();
      this.setColor(color);
      this.context.globalAlpha = this.alpha;
      this.context.lineWidth = this.line_width;
      if (this.initDrawOp(x, y)) {
        this.context.beginPath();
        this.context.arc(0, 0, radius, angle1 / 180 * Math.PI, angle2 / 180 * Math.PI, ccw);
        this.context.fill();
        return this.closeDrawOp(x, -y);
      } else {
        this.context.beginPath();
        this.context.arc(x, y, radius, angle1 / 180 * Math.PI, angle2 / 180 * Math.PI, ccw);
        return this.context.fill();
      }
    }

    textWidth(text, size) {
      this.initContext();
      this.context.font = `${size}pt ${this.font}`;
      return this.context.measureText(text).width;
    }

    drawText(text, x, y, size, color) {
      var h, w;
      this.initContext();
      this.setColor(color);
      this.context.globalAlpha = this.alpha;
      this.context.font = `${size}pt ${this.font}`;
      this.context.textAlign = "center";
      this.context.textBaseline = "middle";
      w = this.context.measureText(text).width;
      h = size;
      if (this.initDrawOp(x, y)) {
        this.context.fillText(text, 0 - this.anchor_x * w / 2, 0 + this.anchor_y * h / 2);
        return this.closeDrawOp(x, y);
      } else {
        return this.context.fillText(text, x - this.anchor_x * w / 2, y + this.anchor_y * h / 2);
      }
    }

    drawTextOutline(text, x, y, size, color) {
      var h, w;
      this.initContext();
      this.setColor(color);
      this.context.globalAlpha = this.alpha;
      this.context.font = `${size}pt ${this.font}`;
      this.context.lineWidth = this.line_width;
      this.context.textAlign = "center";
      this.context.textBaseline = "middle";
      w = this.context.measureText(text).width;
      h = size;
      if (this.initDrawOp(x, y)) {
        this.context.strokeText(text, 0 - this.anchor_x * w / 2, 0 + this.anchor_y * h / 2);
        return this.closeDrawOp(x, y);
      } else {
        return this.context.strokeText(text, x - this.anchor_x * w / 2, y + this.anchor_y * h / 2);
      }
    }

    getSpriteFrame(sprite) {
      var dt, frame, s;
      frame = null;
      if (typeof sprite === "string") {
        s = window.player.runtime.sprites[sprite];
        if (s != null) {
          sprite = s;
        } else {
          s = sprite.split(".");
          if (s.length > 1) {
            sprite = window.player.runtime.sprites[s[0]];
            frame = s[1] | 0;
          }
        }
      } else if (sprite instanceof msImage) {
        return sprite.canvas || sprite.image;
      }
      if ((sprite == null) || !sprite.ready) {
        return null;
      }
      if (sprite.frames.length > 1) {
        if (frame == null) {
          dt = 1000 / sprite.fps;
          frame = Math.floor((Date.now() - sprite.animation_start) / dt) % sprite.frames.length;
        }
        if (frame >= 0 && frame < sprite.frames.length) {
          return sprite.frames[frame].canvas;
        } else {
          return sprite.frames[0].canvas;
        }
      } else if (sprite.frames[0] != null) {
        return sprite.frames[0].canvas;
      } else {
        return null;
      }
    }

    drawImage(sprite, x, y, w, h) {
      return this.drawSprite(sprite, x, y, w, h);
    }

    drawSprite(sprite, x, y, w, h) {
      var canvas;
      this.initContext();
      canvas = this.getSpriteFrame(sprite);
      if (canvas == null) {
        return;
      }
      if (w == null) {
        w = canvas.width;
      }
      if (!h) {
        h = w / canvas.width * canvas.height;
      }
      this.context.globalAlpha = this.alpha;
      this.context.imageSmoothingEnabled = !this.pixelated;
      if (this.initDrawOp(x, y)) {
        this.context.drawImage(canvas, -w / 2 - this.anchor_x * w / 2, -h / 2 + this.anchor_y * h / 2, w, h);
        return this.closeDrawOp(x, y);
      } else {
        return this.context.drawImage(canvas, x - w / 2 - this.anchor_x * w / 2, y - h / 2 + this.anchor_y * h / 2, w, h);
      }
    }

    drawImagePart(sprite, sx, sy, sw, sh, x, y, w, h) {
      return this.drawSpritePart(sprite, sx, sy, sw, sh, x, y, w, h);
    }

    drawSpritePart(sprite, sx, sy, sw, sh, x, y, w, h) {
      var canvas;
      this.initContext();
      canvas = this.getSpriteFrame(sprite);
      if (canvas == null) {
        return;
      }
      if (w == null) {
        w = canvas.width;
      }
      if (!h) {
        h = w / sw * sh;
      }
      this.context.globalAlpha = this.alpha;
      this.context.imageSmoothingEnabled = !this.pixelated;
      if (this.initDrawOp(x, y)) {
        this.context.drawImage(canvas, sx, sy, sw, sh, -w / 2 - this.anchor_x * w / 2, -h / 2 + this.anchor_y * h / 2, w, h);
        return this.closeDrawOp(x, y);
      } else {
        return this.context.drawImage(canvas, sx, sy, sw, sh, x - w / 2 - this.anchor_x * w / 2, y - h / 2 + this.anchor_y * h / 2, w, h);
      }
    }

    drawMap(map, x, y, w, h) {
      this.initContext();
      if (typeof map === "string") {
        map = window.player.runtime.maps[map];
      }
      if ((map == null) || !map.ready) {
        return;
      }
      this.context.globalAlpha = this.alpha;
      this.context.imageSmoothingEnabled = !this.pixelated;
      if (this.initDrawOp(x, y)) {
        map.draw(this.context, -w / 2 - this.anchor_x * w / 2, -h / 2 + this.anchor_y * h / 2, w, h);
        return this.closeDrawOp(x, y);
      } else {
        return map.draw(this.context, x - w / 2 - this.anchor_x * w / 2, y - h / 2 + this.anchor_y * h / 2, w, h);
      }
    }

  };

  msImage.classname = "Image";

  return msImage;

}).call(this);

this.BLENDING_MODES = {
  normal: "source-over",
  additive: "lighter"
};

ref = ["source-over", "source-in", "source-out", "source-atop", "destination-over", "destination-in", "destination-out", "destination-atop", "lighter", "copy", "xor", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"];
for (j = 0, len1 = ref.length; j < len1; j++) {
  b = ref[j];
  this.BLENDING_MODES[b] = b;
}

this.MicroMap = (function() {
  function MicroMap(width, height, block_width, block_height) {
    this.width = width;
    this.height = height;
    this.block_width = block_width;
    this.block_height = block_height;
    this.sprites = (typeof window !== "undefined" && window.player && window.player.runtime && window.player.runtime.sprites) ? window.player.runtime.sprites : {};
    this.map = [];
    this.ready = true;
    this.clear();
  }

  MicroMap.prototype.clear = function() {
    var i, j, k, l, ref1, ref2;
    for (j = k = 0, ref1 = this.height - 1; k <= ref1; j = k += 1) {
      for (i = l = 0, ref2 = this.width - 1; l <= ref2; i = l += 1) {
        this.map[i + j * this.width] = null;
      }
    }
  };

  MicroMap.prototype.set = function(x, y, ref) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      if (typeof ref === "string") {
        ref = ref.replace(/\//g, "-");
      }
      this.map[x + y * this.width] = ref;
      return this.needs_update = true;
    }
  };

  MicroMap.prototype.get = function(x, y) {
    var c;
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return 0;
    }
    c = this.map[x + y * this.width];
    if (typeof c === "string") {
      c = c.replace(/-/g, "/");
    }
    return c || 0;
  };

  MicroMap.prototype.getCanvas = function() {
    if ((this.canvas == null) || this.needs_update) {
      this.update();
    }
    return this.canvas;
  };

  MicroMap.prototype.draw = function(context, x, y, w, h) {
    var a, c, ctx, k, len, len1, ref1, time;
    if ((this.animated != null) && this.animated.length > 0) {
      time = Date.now();
      if ((this.buffer == null) || this.buffer.width !== this.block_width * this.width || this.buffer.height !== this.block_height * this.height) {
        console.info("creating buffer");
        this.buffer = document.createElement("canvas");
        this.buffer.width = this.block_width * this.width;
        this.buffer.height = this.block_height * this.height;
      }
      ctx = this.buffer.getContext("2d");
      ctx.clearRect(0, 0, this.buffer.width, this.buffer.height);
      ctx.drawImage(this.getCanvas(), 0, 0);
      ref1 = this.animated;
      for (k = 0, len1 = ref1.length; k < len1; k++) {
        a = ref1[k];
        len = a.sprite.frames.length;
        c = a.sprite.frames[Math.floor(time / 1000 * a.sprite.fps) % len].canvas;
        if (a.tx != null) {
          ctx.drawImage(c, a.tx, a.ty, this.block_width, this.block_height, a.x, a.y, this.block_width, this.block_height);
        } else {
          ctx.drawImage(c, a.x, a.y, this.block_width, this.block_height);
        }
      }
      context.drawImage(this.buffer, x, y, w, h);
    } else {
      context.drawImage(this.getCanvas(), x, y, w, h);
    }
  };

  MicroMap.prototype.update = function() {
    var a, c, context, i, index, j, k, l, ref1, ref2, s, sprite, tx, ty, xy;
    this.needs_update = false;
    if (this.canvas == null) {
      this.canvas = document.createElement("canvas");
    }
    if (this.canvas.width !== this.width * this.block_width || this.canvas.height !== this.height * this.block_height) {
      this.canvas.width = this.width * this.block_width;
      this.canvas.height = this.height * this.block_height;
    }
    context = this.canvas.getContext("2d");
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.animated = [];
    for (j = k = 0, ref1 = this.height - 1; k <= ref1; j = k += 1) {
      for (i = l = 0, ref2 = this.width - 1; l <= ref2; i = l += 1) {
        index = i + (this.height - 1 - j) * this.width;
        s = this.map[index];
        if ((s != null) && s.length > 0) {
          s = s.split(":");
          sprite = this.sprites[s[0]];
          if (sprite == null) {
            sprite = this.sprites[s[0].replace(/-/g, "/")];
          }
          if ((sprite != null) && (sprite.frames[0] != null)) {
            if (sprite.frames.length > 1) {
              a = {
                x: this.block_width * i,
                y: this.block_height * j,
                w: this.block_width,
                h: this.block_height,
                sprite: sprite
              };
              if (s[1] != null) {
                xy = s[1].split(",");
                a.tx = xy[0] * this.block_width;
                a.ty = xy[1] * this.block_height;
              }
              this.animated.push(a);
              continue;
            }
            if (s[1] != null) {
              xy = s[1].split(",");
              tx = xy[0] * this.block_width;
              ty = xy[1] * this.block_height;
              c = sprite.frames[0].canvas;
              if ((c != null) && c.width > 0 && c.height > 0) {
                context.drawImage(c, tx, ty, this.block_width, this.block_height, this.block_width * i, this.block_height * j, this.block_width, this.block_height);
              }
            } else {
              c = sprite.frames[0].canvas;
              if ((c != null) && c.width > 0 && c.height > 0) {
                context.drawImage(c, this.block_width * i, this.block_height * j);
              }
            }
          }
        }
      }
    }
  };

  MicroMap.prototype.loadFile = function(url) {
    var req;
    req = new XMLHttpRequest();
    req.onreadystatechange = (function(_this) {
      return function(event) {
        if (req.readyState === XMLHttpRequest.DONE) {
          if (req.status === 200) {
            _this.load(req.responseText, _this.sprites);
            return _this.update();
          }
        }
      };
    })(this);
    req.open("GET", url);
    return req.send();
  };

  MicroMap.prototype.load = function(data, sprites) {
    var i, j, k, l, ref1, ref2, s;
    data = JSON.parse(data);
    this.width = data.width;
    this.height = data.height;
    this.block_width = data.block_width;
    this.block_height = data.block_height;
    for (j = k = 0, ref1 = data.height - 1; k <= ref1; j = k += 1) {
      for (i = l = 0, ref2 = data.width - 1; l <= ref2; i = l += 1) {
        s = data.data[i + j * data.width];
        if (s > 0) {
          this.map[i + j * data.width] = data.sprites[s];
        } else {
          this.map[i + j * data.width] = null;
        }
      }
    }
  };

  MicroMap.prototype.clone = function() {
    var i, j, k, l, map, ref1, ref2;
    map = new MicroMap(this.width, this.height, this.block_width, this.block_height, this.sprites);
    for (j = k = 0, ref1 = this.height - 1; k <= ref1; j = k += 1) {
      for (i = l = 0, ref2 = this.width - 1; l <= ref2; i = l += 1) {
        map.map[i + j * this.width] = this.map[i + j * this.width];
      }
    }
    map.needs_update = true;
    return map;
  };

  MicroMap.prototype.copyFrom = function(map) {
    var i, j, k, l, ref1, ref2;
    this.width = map.width;
    this.height = map.height;
    this.block_width = map.block_width;
    this.block_height = map.block_height;
    for (j = k = 0, ref1 = this.height - 1; k <= ref1; j = k += 1) {
      for (i = l = 0, ref2 = this.width - 1; l <= ref2; i = l += 1) {
        this.map[i + j * this.width] = map.map[i + j * this.width];
      }
    }
    this.update();
    return this;
  };

  return MicroMap;

})();

this.LoadMap = function(url, loaded, data) {
  var map, req;
  map = new MicroMap(1, 1, 1, 1);
  if (data != null) {
    map.ready = true;
    UpdateMap(map, data);
    map.needs_update = true;
    if (loaded != null) {
      setTimeout(loaded, 0);
    }
    return map;
  }
  map.ready = false;
  req = new XMLHttpRequest();
  req.onreadystatechange = (function(_this) {
    return function(event) {
      if (req.readyState === XMLHttpRequest.DONE) {
        map.ready = true;
        if (req.status === 200) {
          UpdateMap(map, req.responseText);
        }
        map.needs_update = true;
        if (loaded != null) {
          return loaded();
        }
      }
    };
  })(this);
  req.onerror = function() {
    map.ready = true;
    map.needs_update = true;
    if (loaded != null) {
      return loaded();
    }
  };
  req.open("GET", url);
  req.send();
  return map;
};

this.UpdateMap = function(map, data) {
  var i, j, k, l, ref1, ref2, s;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch (e) {
      return map;
    }
  }
  map.width = data.width;
  map.height = data.height;
  map.block_width = data.block_width;
  map.block_height = data.block_height;
  for (j = k = 0, ref1 = data.height - 1; k <= ref1; j = k += 1) {
    for (i = l = 0, ref2 = data.width - 1; l <= ref2; i = l += 1) {
      s = data.data[i + j * data.width];
      if (s > 0) {
        map.map[i + j * data.width] = data.sprites[s];
      } else {
        map.map[i + j * data.width] = null;
      }
    }
  }
  map.needs_update = true;
  return map;
};

this.SaveMap = function(map) {
  var data, i, index, j, k, l, list, m, n, o, ref1, ref2, ref3, ref4, s, table;
  index = 1;
  list = [0];
  table = {};
  for (j = k = 0, ref1 = map.height - 1; k <= ref1; j = k += 1) {
    for (i = l = 0, ref2 = map.width - 1; l <= ref2; i = l += 1) {
      s = map.map[i + j * map.width];
      if ((s != null) && s.length > 0 && (table[s] == null)) {
        list.push(s);
        table[s] = index++;
      }
    }
  }
  m = [];
  for (j = n = 0, ref3 = map.height - 1; n <= ref3; j = n += 1) {
    for (i = o = 0, ref4 = map.width - 1; o <= ref4; i = o += 1) {
      s = map.map[i + j * map.width];
      m[i + j * map.width] = (s != null) && s.length > 0 ? table[s] : 0;
    }
  }
  data = {
    width: map.width,
    height: map.height,
    block_width: map.block_width,
    block_height: map.block_height,
    sprites: list,
    data: m
  };
  return JSON.stringify(data);
};

this.AudioCore = (function() {
  function AudioCore(runtime) {
    this.runtime = runtime;
    this.buffer = [];
    this.getContext();
    this.playing = [];
    this.wakeup_list = [];
  }

  AudioCore.prototype.isStarted = function() {
    return this.context.state === "running";
  };

  AudioCore.prototype.addToWakeUpList = function(item) {
    return this.wakeup_list.push(item);
  };

  AudioCore.prototype.getInterface = function() {
    var audio;
    audio = this;
    return this["interface"] = {
      beep: function(sequence) {
        return audio.beep(sequence);
      },
      cancelBeeps: function() {
        return audio.cancelBeeps();
      },
      playSound: function(sound, volume, pitch, pan, loopit) {
        return audio.playSound(sound, volume, pitch, pan, loopit);
      },
      playMusic: function(music, volume, loopit) {
        return audio.playMusic(music, volume, loopit);
      }
    };
  };

  AudioCore.prototype.playSound = function(sound, volume, pitch, pan, loopit) {
    var s;
    if (volume == null) {
      volume = 1;
    }
    if (pitch == null) {
      pitch = 1;
    }
    if (pan == null) {
      pan = 0;
    }
    if (loopit == null) {
      loopit = 0;
    }
    if (typeof sound === "string") {
      s = this.runtime.sounds[sound.replace(/\//g, "-")];
      if (s != null) {
        return s.play(volume, pitch, pan, loopit);
      }
    }
    return 0;
  };

  AudioCore.prototype.playMusic = function(music, volume, loopit) {
    var m;
    if (volume == null) {
      volume = 1;
    }
    if (loopit == null) {
      loopit = 0;
    }
    if (typeof music === "string") {
      m = this.runtime.music[music.replace(/\//g, "-")];
      if (m != null) {
        return m.play(volume, loopit);
      }
    }
    return 0;
  };

  AudioCore.prototype.start = function() {
    var blob, src;
    if (false) {
      blob = new Blob([AudioCore.processor], {
        type: "text/javascript"
      });
      return this.context.audioWorklet.addModule(window.URL.createObjectURL(blob)).then((function(_this) {
        return function() {
          _this.node = new AudioWorkletNode(_this.context, "my-worklet-processor");
          _this.node.connect(_this.context.destination);
          return _this.flushBuffer();
        };
      })(this));
    } else {
      this.script_processor = this.context.createScriptProcessor(4096, 2, 2);
      this.processor_funk = (function(_this) {
        return function(event) {
          return _this.onAudioProcess(event);
        };
      })(this);
      this.script_processor.onaudioprocess = this.processor_funk;
      this.script_processor.connect(this.context.destination);
      src = "class AudioWorkletProcessor {\n  constructor() {\n    this.port = {} ;\n\n    var _this = this ;\n\n    this.port.postMessage = function(data) {\n      var event = { data: data } ;\n      _this.port.onmessage(event) ;\n    }\n  }\n\n} ;\nregisterProcessor = function(a,b) {\n  return new MyWorkletProcessor()\n} ;\n";
      src += AudioCore.processor;
      this.node = eval(src);
      this.flushBuffer();
      return this.bufferizer = new AudioBufferizer(this.node);
    }
  };

  AudioCore.prototype.flushBuffer = function() {
    var results;
    results = [];
    while (this.buffer.length > 0) {
      results.push(this.node.port.postMessage(this.buffer.splice(0, 1)[0]));
    }
    return results;
  };

  AudioCore.prototype.onAudioProcess = function(event) {
    var left, outputs, right;
    left = event.outputBuffer.getChannelData(0);
    right = event.outputBuffer.getChannelData(1);
    outputs = [[left, right]];
    this.bufferizer.flush(outputs);
  };

  AudioCore.prototype.getContext = function() {
    var activate;
    if (this.context == null) {
      this.context = new (window.AudioContext || window.webkitAudioContext);
      if (this.context.state !== "running") {
        activate = (function(_this) {
          return function() {
            var item, j, len, ref;
            console.info("resuming context");
            _this.context.resume();
            if (_this.beeper != null) {
              _this.start();
            }
            ref = _this.wakeup_list;
            for (j = 0, len = ref.length; j < len; j++) {
              item = ref[j];
              item.wakeUp();
            }
            document.body.removeEventListener("touchend", activate);
            return document.body.removeEventListener("mouseup", activate);
          };
        })(this);
        document.body.addEventListener("touchend", activate);
        document.body.addEventListener("mouseup", activate);
      } else if (this.beeper != null) {
        this.start();
      }
    }
    return this.context;
  };

  AudioCore.prototype.getBeeper = function() {
    if (this.beeper == null) {
      this.beeper = new Beeper(this);
      if (this.context.state === "running") {
        this.start();
      }
    }
    return this.beeper;
  };

  AudioCore.prototype.beep = function(sequence) {
    return this.getBeeper().beep(sequence);
  };

  AudioCore.prototype.addBeeps = function(beeps) {
    var b, j, len;
    for (j = 0, len = beeps.length; j < len; j++) {
      b = beeps[j];
      b.duration *= this.context.sampleRate;
      b.increment = b.frequency / this.context.sampleRate;
    }
    if (this.node != null) {
      return this.node.port.postMessage(JSON.stringify({
        name: "beep",
        sequence: beeps
      }));
    } else {
      return this.buffer.push(JSON.stringify({
        name: "beep",
        sequence: beeps
      }));
    }
  };

  AudioCore.prototype.cancelBeeps = function() {
    if (this.node != null) {
      this.node.port.postMessage(JSON.stringify({
        name: "cancel_beeps"
      }));
    } else {
      this.buffer.push(JSON.stringify({
        name: "cancel_beeps"
      }));
    }
    return this.stopAll();
  };

  AudioCore.prototype.addPlaying = function(item) {
    return this.playing.push(item);
  };

  AudioCore.prototype.removePlaying = function(item) {
    var index;
    index = this.playing.indexOf(item);
    if (index >= 0) {
      return this.playing.splice(index, 1);
    }
  };

  AudioCore.prototype.stopAll = function() {
    var err, j, len, p, ref;
    ref = this.playing;
    for (j = 0, len = ref.length; j < len; j++) {
      p = ref[j];
      try {
        p.stop();
      } catch (error) {
        err = error;
        console.error(err);
      }
    }
    return this.playing = [];
  };

  AudioCore.processor = "class MyWorkletProcessor extends AudioWorkletProcessor {\n  constructor() {\n    super();\n    this.beeps = [] ;\n    this.last = 0 ;\n    this.port.onmessage = (event) => {\n      let data = JSON.parse(event.data) ;\n      if (data.name == \"cancel_beeps\")\n      {\n        this.beeps = [] ;\n      }\n      else if (data.name == \"beep\")\n      {\n        let seq = data.sequence ;\n        for (let i=0;i<seq.length;i++)\n        {\n          let note = seq[i] ;\n          if (i>0)\n          {\n            seq[i-1].next = note ;\n          }\n\n          if (note.loopto != null)\n          {\n            note.loopto = seq[note.loopto] ;\n          }\n\n          note.phase = 0 ;\n          note.time = 0 ;\n        }\n\n        this.beeps.push(seq[0]) ;\n      }\n    } ;\n  }\n\n  process(inputs, outputs, parameters) {\n    var output = outputs[0] ;\n    var phase ;\n    for (var i=0;i<output.length;i++)\n    {\n      var channel = output[i] ;\n      if (i>0)\n      {\n        for (var j=0;j<channel.length;j++)\n        {\n          channel[j] = output[0][j]\n        }\n      }\n      else\n      {\n        for (var j=0;j<channel.length;j++)\n        {\n          let sig = 0 ;\n          for (var k=this.beeps.length-1;k>=0;k--)\n          {\n            let b = this.beeps[k];\n            let volume = b.volume ;\n            if (b.time/b.duration>b.span)\n              {\n                volume = 0 ;\n              }\n            if (b.waveform == \"square\")\n            {\n              sig += b.phase>.5? volume : -volume ;\n            }\n            else if (b.waveform == \"saw\")\n            {\n              sig += (b.phase*2-1)*volume ;\n            }\n            else if (b.waveform == \"noise\")\n            {\n              sig += (Math.random()*2-1)*volume ;\n            }\n            else\n            {\n              sig += Math.sin(b.phase*Math.PI*2)*volume ;\n            }\n\n            b.phase = (b.phase+b.increment)%1 ;\n            b.time += 1 ;\n            if (b.time>=b.duration)\n            {\n              b.time = 0 ;\n              if (b.loopto != null)\n              {\n                if (b.repeats != null && b.repeats>0)\n                {\n                  if (b.loopcount == null)\n                  {\n                    b.loopcount = 0 ;\n                  }\n                  b.loopcount++ ;\n                  if (b.loopcount>=b.repeats)\n                  {\n                    b.loopcount = 0 ;\n                    if (b.next != null)\n                    {\n                      b.next.phase = b.phase ;\n                      b = b.next ;\n                      this.beeps[k] = b ;\n                    }\n                    else\n                    {\n                      this.beeps.splice(k,1) ;\n                    }\n                  }\n                  else\n                  {\n                    b.loopto.phase = b.phase ;\n                    b = b.loopto ;\n                    this.beeps[k] = b ;\n                  }\n                }\n                else\n                {\n                  b.loopto.phase = b.phase ;\n                  b = b.loopto ;\n                  this.beeps[k] = b ;\n                }\n              }\n              else if (b.next != null)\n              {\n                b.next.phase = b.phase ;\n                b = b.next ;\n                this.beeps[k] = b ;\n              }\n              else\n              {\n                this.beeps.splice(k,1) ;\n              }\n            }\n          }\n          this.last = this.last*.9+sig*.1 ;\n          channel[j] = this.last ;\n        }\n      }\n    }\n    return true ;\n  }\n}\n\nregisterProcessor('my-worklet-processor', MyWorkletProcessor);";

  return AudioCore;

})();

this.AudioBufferizer = (function() {
  function AudioBufferizer(node) {
    var i, j, k, left, ref, right;
    this.node = node;
    this.buffer_size = 4096;
    this.chunk_size = 512;
    this.chunks = [];
    this.nb_chunks = this.buffer_size / this.chunk_size;
    for (i = j = 0, ref = this.nb_chunks - 1; j <= ref; i = j += 1) {
      left = (function() {
        var n, ref1, results;
        results = [];
        for (k = n = 0, ref1 = this.chunk_size - 1; 0 <= ref1 ? n <= ref1 : n >= ref1; k = 0 <= ref1 ? ++n : --n) {
          results.push(0);
        }
        return results;
      }).call(this);
      right = (function() {
        var n, ref1, results;
        results = [];
        for (k = n = 0, ref1 = this.chunk_size - 1; 0 <= ref1 ? n <= ref1 : n >= ref1; k = 0 <= ref1 ? ++n : --n) {
          results.push(0);
        }
        return results;
      }).call(this);
      this.chunks[i] = [[left, right]];
    }
    this.current = 0;
    setInterval(((function(_this) {
      return function() {
        return _this.step();
      };
    })(this)), this.chunk_size / 44100 * 1000);
  }

  AudioBufferizer.prototype.step = function() {
    if (this.current >= this.chunks.length) {
      return;
    }
    this.node.process(null, this.chunks[this.current], null);
    this.current++;
  };

  AudioBufferizer.prototype.flush = function(outputs) {
    var chunk, i, index, j, k, l, left, n, r, ref, ref1, right;
    while (this.current < this.chunks.length) {
      this.step();
    }
    this.current = 0;
    left = outputs[0][0];
    right = outputs[0][1];
    index = 0;
    chunk = 0;
    for (i = j = 0, ref = this.chunks.length - 1; 0 <= ref ? j <= ref : j >= ref; i = 0 <= ref ? ++j : --j) {
      chunk = this.chunks[i];
      l = chunk[0][0];
      r = chunk[0][1];
      for (k = n = 0, ref1 = l.length - 1; 0 <= ref1 ? n <= ref1 : n >= ref1; k = 0 <= ref1 ? ++n : --n) {
        left[index] = l[k];
        right[index] = r[k];
        index += 1;
      }
    }
  };

  return AudioBufferizer;

})();

this.Beeper = (function() {
  function Beeper(audio) {
    var i, j, k, l, len, len1, n, oct, ref, ref1, text;
    this.audio = audio;
    this.notes = {};
    this.plain_notes = {};
    text = [["C", "DO"], ["C#", "DO#", "Db", "REb"], ["D", "RE"], ["D#", "RE#", "Eb", "MIb"], ["E", "MI"], ["F", "FA"], ["F#", "FA#", "Gb", "SOLb"], ["G", "SOL"], ["G#", "SOL#", "Ab", "LAb"], ["A", "LA"], ["A#", "LA#", "Bb", "SIb"], ["B", "SI"]];
    for (i = j = 0; j <= 127; i = j += 1) {
      this.notes[i] = i;
      oct = Math.floor(i / 12) - 1;
      ref = text[i % 12];
      for (k = 0, len = ref.length; k < len; k++) {
        n = ref[k];
        this.notes[n + oct] = i;
      }
      if (oct === -1) {
        ref1 = text[i % 12];
        for (l = 0, len1 = ref1.length; l < len1; l++) {
          n = ref1[l];
          this.plain_notes[n] = i;
        }
      }
    }
    this.current_octave = 5;
    this.current_duration = .5;
    this.current_volume = .5;
    this.current_span = 1;
    this.current_waveform = "square";
  }

  Beeper.prototype.beep = function(input) {
    var i, j, k, len, loops, lop, n, note, parsed, ref, ref1, sequence, status, t, test;
    test = "loop 0 square tempo 120 duration 500 volume 50 span 50 DO2 DO - FA SOL SOL FA -";
    status = "normal";
    sequence = [];
    loops = [];
    parsed = input.split(" ");
    for (j = 0, len = parsed.length; j < len; j++) {
      t = parsed[j];
      if (t === "") {
        continue;
      }
      switch (status) {
        case "normal":
          if (this.notes[t] != null) {
            note = this.notes[t];
            this.current_octave = Math.floor(note / 12);
            sequence.push({
              frequency: 440 * Math.pow(Math.pow(2, 1 / 12), note - 69),
              volume: this.current_volume,
              span: this.current_span,
              duration: this.current_duration,
              waveform: this.current_waveform
            });
          } else if (this.plain_notes[t] != null) {
            note = this.plain_notes[t] + this.current_octave * 12;
            sequence.push({
              frequency: 440 * Math.pow(Math.pow(2, 1 / 12), note - 69),
              volume: this.current_volume,
              span: this.current_span,
              duration: this.current_duration,
              waveform: this.current_waveform
            });
          } else if (t === "square" || t === "sine" || t === "saw" || t === "noise") {
            this.current_waveform = t;
          } else if (t === "tempo" || t === "duration" || t === "volume" || t === "span" || t === "loop" || t === "to") {
            status = t;
          } else if (t === "-") {
            sequence.push({
              frequency: 440,
              volume: 0,
              span: this.current_span,
              duration: this.current_duration,
              waveform: this.current_waveform
            });
          } else if (t === "end") {
            if (loops.length > 0 && sequence.length > 0) {
              sequence.push({
                frequency: 440,
                volume: 0,
                span: this.current_span,
                duration: 0,
                waveform: this.current_waveform
              });
              lop = loops.splice(loops.length - 1, 1)[0];
              sequence[sequence.length - 1].loopto = lop.start;
              sequence[sequence.length - 1].repeats = lop.repeats;
            }
          }
          break;
        case "tempo":
          status = "normal";
          t = Number.parseFloat(t);
          if (!Number.isNaN(t) && t > 0) {
            this.current_duration = 60 / t;
          }
          break;
        case "duration":
          status = "normal";
          t = Number.parseFloat(t);
          if (!Number.isNaN(t) && t > 0) {
            this.current_duration = t / 1000;
          }
          break;
        case "volume":
          status = "normal";
          t = Number.parseFloat(t);
          if (!Number.isNaN(t)) {
            this.current_volume = t / 100;
          }
          break;
        case "span":
          status = "normal";
          t = Number.parseFloat(t);
          if (!Number.isNaN(t)) {
            this.current_span = t / 100;
          }
          break;
        case "loop":
          status = "normal";
          loops.push({
            start: sequence.length
          });
          t = Number.parseFloat(t);
          if (!Number.isNaN(t)) {
            loops[loops.length - 1].repeats = t;
          }
          break;
        case "to":
          status = "normal";
          if (note != null) {
            n = null;
            if (this.notes[t] != null) {
              n = this.notes[t];
            } else if (this.plain_notes[t] != null) {
              n = this.plain_notes[t] + this.current_octave * 12;
            }
            if ((n != null) && n !== note) {
              for (i = k = ref = note, ref1 = n; ref <= ref1 ? k <= ref1 : k >= ref1; i = ref <= ref1 ? ++k : --k) {
                if (i !== note) {
                  sequence.push({
                    frequency: 440 * Math.pow(Math.pow(2, 1 / 12), i - 69),
                    volume: this.current_volume,
                    span: this.current_span,
                    duration: this.current_duration,
                    waveform: this.current_waveform
                  });
                }
              }
              note = n;
            }
          }
      }
    }
    if (loops.length > 0 && sequence.length > 0) {
      lop = loops.splice(loops.length - 1, 1)[0];
      sequence.push({
        frequency: 440,
        volume: 0,
        span: this.current_span,
        duration: 0,
        waveform: this.current_waveform
      });
      sequence[sequence.length - 1].loopto = lop.start;
      sequence[sequence.length - 1].repeats = lop.repeats;
    }
    return this.audio.addBeeps(sequence);
  };

  return Beeper;

})();

this.Sound = class Sound {
  constructor(audio, url) {
    var request;
    this.audio = audio;
    this.url = url;
    if (typeof MicroSound !== "undefined" && MicroSound !== null) {
      this.class = MicroSound;
    }
    if (this.url instanceof AudioBuffer) {
      this.buffer = this.url;
      this.ready = 1;
    } else {
      this.ready = 0;
      request = new XMLHttpRequest();
      request.open('GET', this.url, true);
      request.responseType = 'arraybuffer';
      request.onload = () => {
        return this.audio.context.decodeAudioData(request.response, (buffer1) => {
          this.buffer = buffer1;
          return this.ready = 1;
        });
      };
      request.send();
    }
  }

  play(volume = 1, pitch = 1, pan = 0, loopit = false) {
    var gain, panner, playing, res, source;
    if (this.buffer == null) {
      return;
    }
    source = this.audio.context.createBufferSource();
    source.playbackRate.value = pitch;
    source.buffer = this.buffer;
    if (loopit) {
      source.loop = true;
    }
    gain = this.audio.context.createGain();
    gain.gain.value = volume;
    if (false && (this.audio.context.createStereoPanner != null)) {
      panner = this.audio.context.createStereoPanner();
      panner.setPan = function(pan) {
        return panner.pan.value = pan;
      };
    } else {
      panner = this.audio.context.createPanner();
      panner.panningModel = "equalpower";
      panner.setPan = function(pan) {
        return panner.setPosition(pan, 0, 1 - Math.abs(pan));
      };
    }
    panner.setPan(pan);
    source.connect(gain);
    gain.connect(panner);
    panner.connect(this.audio.context.destination);
    source.start();
    playing = null;
    if (loopit) {
      playing = {
        stop: () => {
          return source.stop();
        }
      };
      this.audio.addPlaying(playing);
    }
    res = {
      stop: () => {
        source.stop();
        if (playing) {
          this.audio.removePlaying(playing);
        }
        return 1;
      },
      setVolume: function(volume) {
        return gain.gain.value = Math.max(0, Math.min(1, volume));
      },
      setPitch: function(pitch) {
        return source.playbackRate.value = Math.max(.001, Math.min(1000, pitch));
      },
      setPan: function(pan) {
        return panner.setPan(Math.max(-1, Math.min(1, pan)));
      },
      getDuration: function() {
        return source.buffer.duration;
      },
      finished: false
    };
    source.onended = function() {
      return res.finished = true;
    };
    return res;
  }

  static createSoundClass(audiocore) {
    return window.MicroSound = (function() {
      var _Class;

      _Class = class {
        constructor(channels, length, sampleRate = 44100) {
          var buffer, ch1, ch2, snd;
          this.class = MicroSound;
          channels = channels === 1 ? 1 : 2;
          if (!(length > 1) || !(length < 44100 * 1000)) {
            length = 44100;
          }
          if (!(sampleRate >= 8000) || !(sampleRate <= 96000)) {
            sampleRate = 44100;
          }
          buffer = audiocore.context.createBuffer(channels, length, sampleRate);
          snd = new Sound(audiocore, buffer);
          this.channels = channels;
          this.length = length;
          this.sampleRate = sampleRate;
          ch1 = buffer.getChannelData(0);
          if (channels === 2) {
            ch2 = buffer.getChannelData(1);
          }
          this.play = function(volume, pitch, pan, loopit) {
            return snd.play(volume, pitch, pan, loopit);
          };
          this.write = function(channel, position, value) {
            if (channel === 0) {
              ch1 = buffer.getChannelData(0);
              return ch1[position] = value;
            } else if (channels === 2) {
              ch2 = buffer.getChannelData(1);
              return ch2[position] = value;
            }
          };
          this.read = function(channel, position) {
            if (channel === 0) {
              ch1 = buffer.getChannelData(0);
              return ch1[position];
            } else if (channels === 2) {
              ch2 = buffer.getChannelData(1);
              return ch2[position];
            } else {
              return 0;
            }
          };
        }

      };

      _Class.classname = "Sound";

      return _Class;

    }).call(this);
  }

};

this.Music = (function() {
  function Music(audio, url) {
    this.audio = audio;
    this.url = url;
    this.tag = new Audio(this.url);
    this.playing = false;
  }

  Music.prototype.play = function(volume, loopit) {
    if (volume == null) {
      volume = 1;
    }
    if (loopit == null) {
      loopit = false;
    }
    this.playing = true;
    this.tag.loop = loopit ? true : false;
    this.tag.volume = volume;
    if (this.audio.isStarted()) {
      this.tag.play();
    } else {
      this.audio.addToWakeUpList(this);
    }
    this.audio.addPlaying(this);
    return {
      play: (function(_this) {
        return function() {
          return _this.tag.play();
        };
      })(this),
      stop: (function(_this) {
        return function() {
          _this.playing = false;
          _this.tag.pause();
          return _this.audio.removePlaying(_this);
        };
      })(this),
      setVolume: (function(_this) {
        return function(volume) {
          return _this.tag.volume = Math.max(0, Math.min(1, volume));
        };
      })(this),
      getPosition: (function(_this) {
        return function() {
          return _this.tag.currentTime;
        };
      })(this),
      getDuration: (function(_this) {
        return function() {
          return _this.tag.duration;
        };
      })(this),
      setPosition: (function(_this) {
        return function(pos) {
          _this.tag.pause();
          _this.tag.currentTime = Math.max(0, Math.min(_this.tag.duration, pos));
          if (_this.playing) {
            return _this.tag.play();
          }
        };
      })(this)
    };
  };

  Music.prototype.wakeUp = function() {
    if (this.playing) {
      return this.tag.play();
    }
  };

  Music.prototype.stop = function() {
    this.playing = false;
    return this.tag.pause();
  };

  return Music;

})();

this.Player = class Player {
  constructor(listener) {
    if (typeof window !== "undefined") {
      window.player = this;
    }
    var i, len, ref, source;
    this.listener = listener;
    //src = document.getElementById("code").innerText
    this.source_count = 0;
    this.sources = {};
    this.resources = resources;
    this.request_id = 1;
    this.pending_requests = {};
    if (resources.sources != null && Array.isArray(resources.sources)) {
      ref = resources.sources;
      for (i = 0, len = ref.length; i < len; i++) {
        source = ref[i];
        this.loadSource(source);
      }
    } else if (resources.microscript != null && Object.keys(resources.microscript).length > 0) {
      for (const [key, val] of Object.entries(resources.microscript)) {
        const name = key.split(".")[0];
        this.sources[name] = val;
      }
      this.start();
    } else {
      const codeEl = document.getElementById("code");
      this.sources.main = codeEl ? (codeEl.textContent || codeEl.innerText || "") : "";
      this.start();
    }
  }

  loadSource(source) {
    var req;
    req = new XMLHttpRequest();
    req.onreadystatechange = (event) => {
      var name;
      if (req.readyState === XMLHttpRequest.DONE) {
        if (req.status === 200) {
          name = source.file.split(".")[0];
          this.sources[name] = req.responseText;
          this.source_count++;
          if (this.source_count >= resources.sources.length && (this.runtime == null)) {
            return this.start();
          }
        }
      }
    };
    req.open("GET", location.origin + location.pathname + `ms/${source.file}?v=${source.version}`);
    return req.send();
  }

  start() {
    var touchListener, touchStartListener, wrapper;
    this.runtime = new Runtime((window.exported_project ? "" : location.origin + location.pathname), this.sources, resources, this);
    this.client = new PlayerClient(this);
    wrapper = document.getElementById("canvaswrapper");
    wrapper.appendChild(this.runtime.screen.canvas);
    window.addEventListener("resize", () => {
      return this.resize();
    });
    this.resize();
    //@runtime.start()
    touchStartListener = (event) => {
      event.preventDefault();
      //event.stopPropagation()
      //event.stopImmediatePropagation()
      this.runtime.screen.canvas.removeEventListener("touchstart", touchStartListener);
      return true;
    };
    touchListener = (event) => {
      //event.preventDefault()
      //event.stopPropagation()
      //event.stopImmediatePropagation()
      //@runtime.screen.canvas.removeEventListener "touchend",touchListener
      if ((this.runtime != null) && (this.runtime.vm != null) && this.runtime.vm.context.global.system.disable_autofullscreen) {
        return true;
      } else {
        this.setFullScreen();
      }
      return true;
    };
    this.runtime.screen.canvas.addEventListener("touchstart", touchStartListener);
    this.runtime.screen.canvas.addEventListener("touchend", touchListener);
    this.runtime.start();
    window.addEventListener("message", (msg) => {
      return this.messageReceived(msg);
    });
    return this.postMessage({
      name: "focus"
    });
  }

  resize() {
    var file, ref, results, src;
    this.runtime.screen.resize();
    if (this.runtime.vm != null) {
      if (this.runtime.vm.context.global.draw == null) {
        this.runtime.update_memory = {};
        ref = this.runtime.sources;
        results = [];
        for (file in ref) {
          src = ref[file];
          results.push(this.runtime.updateSource(file, src, false));
        }
        return results;
      } else if (this.runtime.stopped) {
        return this.runtime.drawCall();
      }
    }
  }

  setFullScreen() {
    var ref;
    if ((document.documentElement.webkitRequestFullScreen != null) && !document.webkitIsFullScreen) {
      document.documentElement.webkitRequestFullScreen();
    } else if ((document.documentElement.requestFullScreen != null) && !document.fullScreen) {
      document.documentElement.requestFullScreen();
    } else if ((document.documentElement.mozRequestFullScreen != null) && !document.mozFullScreen) {
      document.documentElement.mozRequestFullScreen();
    }
    if ((window.screen != null) && (window.screen.orientation != null) && ((ref = window.orientation) === "portrait" || ref === "landscape")) {
      return window.screen.orientation.lock(window.orientation).then(null, function(error) {});
    }
  }

  //console.error error
  reportError(err) {
    return this.postMessage({
      name: "error",
      data: err
    });
  }

  log(text) {
    return this.postMessage({
      name: "log",
      data: text
    });
  }

  codePaused() {
    return this.postMessage({
      name: "code_paused"
    });
  }

  exit() {
    return this.postMessage({
      name: "exit"
    });
  }

  messageReceived(msg) {
    var code, data, err, file;
    data = msg.data;
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch (e) {
        return;
      }
    }
    if (!data || typeof data !== "object") return;
    try {
      switch (data.name) {
        case "command":
          return this.runtime.runCommand(data.line, (res) => {
            if (!data.line.trim().startsWith("print")) {
              return this.postMessage({
                name: "output",
                data: res,
                id: data.id
              });
            }
          });
        case "pause":
          return this.runtime.stop();
        case "step_forward":
          return this.runtime.stepForward();
        case "resume":
          return this.runtime.resume();
        case "code_updated":
          code = data.code;
          file = data.file.split(".")[0];
          if (this.runtime.vm != null) {
            this.runtime.vm.clearWarnings();
          }
          return this.runtime.updateSource(file, code, true);
        case "sprite_updated":
          file = data.file;
          return this.runtime.updateSprite(file, 0, data.data, data.properties);
        case "map_updated":
          file = data.file;
          return this.runtime.updateMap(file, 0, data.data);
        case "take_picture":
          this.runtime.screen.takePicture((pic) => {
            return this.postMessage({
              name: "picture_taken",
              data: pic
            });
          });
          if (this.runtime.stopped) {
            return this.runtime.drawCall();
          }
          break;
        case "time_machine":
          return this.runtime.time_machine.messageReceived(data);
        case "watch":
          return this.runtime.watch(data.list);
        case "stop_watching":
          return this.runtime.stopWatching();
        default:
          if (data.request_id != null) {
            if (this.pending_requests[data.request_id] != null) {
              this.pending_requests[data.request_id](data);
              return delete this.pending_requests[data.request_id];
            }
          }
      }
    } catch (error1) {
      err = error1;
      return console.error(err);
    }
  }

  call(name, args) {
    if ((this.runtime != null) && (this.runtime.vm != null)) {
      return this.runtime.vm.call(name, args);
    }
  }

  setGlobal(name, value) {
    if ((this.runtime != null) && (this.runtime.vm != null)) {
      return this.runtime.vm.context.global[name] = value;
    }
  }

  exec(command, callback) {
    if (this.runtime != null) {
      return this.runtime.runCommand(command, callback);
    }
  }

  postMessage(data) {
    var err;
    if (typeof window !== "undefined" && window.parent && window !== window.parent) {
      try {
        window.parent.postMessage(JSON.stringify(data), "*");
      } catch (e) {}
    }
    if (this.listener != null) {
      try {
        return this.listener(data);
      } catch (error1) {
        err = error1;
        return console.error(err);
      }
    }
  }

  postRequest(data, callback) {
    data.request_id = this.request_id;
    this.pending_requests[this.request_id++] = callback;
    return this.postMessage(data);
  }

};

if (typeof navigator !== "undefined" && (navigator.serviceWorker != null) && !window.skip_service_worker) {
  navigator.serviceWorker.register('sw.js', {
    scope: location.pathname
  }).then(function(reg) {
    return console.log('Registration succeeded. Scope is' + reg.scope);
  }).catch(function(error) {
    return console.log('Registration failed with' + error);
  });
}

this.PlayerClient = class PlayerClient {
  constructor(player) {
    var err;
    this.player = player;
    this.pending_requests = {};
    this.request_id = 0;
    this.version_checked = false;
    this.reconnect_delay = 1000;
    if (location.protocol.startsWith("http") && !window.exported_project) {
      try {
        this.connect();
      } catch (error) {
        err = error;
        console.error(err);
      }
      setInterval((() => {
        if (this.socket != null) {
          return this.sendRequest({
            name: "ping"
          });
        }
      }), 30000);
    }
  }

  connect() {
    this.socket = new WebSocket(window.location.origin.replace("http", "ws"));
    this.socket.onmessage = (msg) => {
      var err;
      try {
        // console.info "received: "+msg.data
        msg = JSON.parse(msg.data);
        if (msg.request_id != null) {
          if (this.pending_requests[msg.request_id] != null) {
            this.pending_requests[msg.request_id](msg);
            delete this.pending_requests[msg.request_id];
          }
        }
        //if msg.name == "code_updated"
        //  @player.runtime.updateSource(msg.file,msg.code,true)

        //if msg.name == "sprite_updated"
        //  @player.runtime.updateSprite(msg.sprite)
        if (msg.name === "project_file_updated") {
          this.player.runtime.projectFileUpdated(msg.type, msg.file, msg.version, msg.data, msg.properties);
        }
        if (msg.name === "project_file_deleted") {
          this.player.runtime.projectFileDeleted(msg.type, msg.file);
        }
        if (msg.name === "project_options_updated") {
          return this.player.runtime.projectOptionsUpdated(msg);
        }
      } catch (error) {
        err = error;
        return console.error(err);
      }
    };
    this.socket.onopen = () => {
      var i, j, k, l, len, len1, len2, len3, m, maps, project, ref, ref1, ref2, ref3, s, sources, sprites, user;
      //console.info "socket opened"
      this.reconnect_delay = 1000;
      user = location.pathname.split("/")[1];
      project = location.pathname.split("/")[2];
      if (this.buffer != null) {
        ref = this.buffer;
        for (i = 0, len = ref.length; i < len; i++) {
          m = ref[i];
          this.send(m);
        }
        delete this.buffer;
      }
      this.send({
        name: "listen_to_project",
        user: user,
        project: project
      });
      if (!this.version_checked) {
        this.version_checked = true;
        sprites = {};
        maps = {};
        sources = {};
        ref1 = this.player.resources.images;
        for (j = 0, len1 = ref1.length; j < len1; j++) {
          s = ref1[j];
          sprites[s.file.split(".")[0]] = s.version;
        }
        ref2 = this.player.resources.maps;
        for (k = 0, len2 = ref2.length; k < len2; k++) {
          s = ref2[k];
          maps[s.file.split(".")[0]] = s.version;
        }
        ref3 = this.player.resources.sources;
        for (l = 0, len3 = ref3.length; l < len3; l++) {
          s = ref3[l];
          sources[s.file.split(".")[0]] = s.version;
        }
        return this.sendRequest({
          name: "get_file_versions",
          user: user,
          project: project
        }, (msg) => {
          var info, name, ref4, ref5, ref6, results, v;
          ref4 = msg.data.sources;
          for (name in ref4) {
            info = ref4[name];
            v = sources[name];
            if ((v == null) || v !== info.version) {
              //console.info "updating #{name} to version #{version}"
              this.player.runtime.projectFileUpdated("ms", name, info.version, null, info.properties);
            }
          }
          ref5 = msg.data.sprites;
          for (name in ref5) {
            info = ref5[name];
            v = sprites[name];
            if ((v == null) || v !== info.version) {
              //console.info "updating #{name} to version #{version}"
              this.player.runtime.projectFileUpdated("sprites", name, info.version, null, info.properties);
            }
          }
          ref6 = msg.data.maps;
          results = [];
          for (name in ref6) {
            info = ref6[name];
            v = maps[name];
            if ((v == null) || v !== info.version) {
              //console.info "updating #{name} to version #{version}"
              results.push(this.player.runtime.projectFileUpdated("maps", name, info.version, null, info.properties));
            } else {
              results.push(void 0);
            }
          }
          return results;
        });
      }
    };
    return this.socket.onclose = () => {
      //console.info "socket closed"
      setTimeout((() => {
        return this.connect();
      }), this.reconnect_delay);
      return this.reconnect_delay += 1000;
    };
  }

  send(data) {
    if (this.socket.readyState !== 1) {
      if (this.buffer == null) {
        this.buffer = [];
      }
      return this.buffer.push(data);
    } else {
      return this.socket.send(JSON.stringify(data));
    }
  }

  sendRequest(msg, callback) {
    msg.request_id = this.request_id++;
    this.pending_requests[msg.request_id] = callback;
    return this.send(msg);
  }

};

