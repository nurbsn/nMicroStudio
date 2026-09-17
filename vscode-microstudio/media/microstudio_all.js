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

var LANGUAGE_MICROSCRIPT, LANGUAGE_MICROSCRIPT2;

LANGUAGE_MICROSCRIPT = {
  ace_mode: "ace/mode/microscript",
  parser: Parser
};

LANGUAGE_MICROSCRIPT2 = {
  ace_mode: "ace/mode/microscript2",
  parser: Parser
};

var LANGUAGE_PYTHON;

LANGUAGE_PYTHON = {
  ace_mode: "ace/mode/python"
};

var LANGUAGE_JAVASCRIPT;

LANGUAGE_JAVASCRIPT = {
  ace_mode: "ace/mode/javascript"
};

var LANGUAGE_LUA;

LANGUAGE_LUA = {
  ace_mode: "ace/mode/lua"
};

this.Client = class Client {
  constructor(app) {
    this.app = app;
    this.pending_requests = {};
    this.request_id = 0;
    this.sends = [];
    setInterval((() => {
      return this.check();
    }), 1000);
    this.listeners = {};
    this.listen("error", (msg) => {
      if (msg.error != null) {
        return this.app.appui.showNotification(this.app.translator.get(msg.error));
      }
    });
  }

  start() {
    this.token = localStorage.getItem("token");
    if (window.ms_standalone) {
      this.token = "---";
    }
    if (this.token != null) {
      setTimeout((() => {
        return this.app.appui.popMenu();
      }), 500);
      return this.connect();
    } else {
      this.app.appui.showLoginButton();
      setTimeout((() => {
        return this.app.appui.popMenu();
      }), 500);
      return this.app.app_state.initState();
    }
  }

  setToken(token) {
    var date;
    this.token = token;
    if (this.token != null) {
      localStorage.setItem("token", this.token);
      date = new Date();
      date.setTime;
      return document.cookie = `token=${this.token};expires=${new Date(Date.now() + 3600000 * 24 * 14).toUTCString()};path=/`;
    } else {
      localStorage.removeItem("token");
      return document.cookie = `token=${this.token};expires=${new Date(Date.now() - 3600000 * 24 * 14).toUTCString()};path=/`;
    }
  }

  checkToken() {
    if (!this.token) {
      return;
    }
    return this.sendRequest({
      name: "token",
      token: this.token
    }, (msg) => {
      var i, len1, n, ref;
      switch (msg.name) {
        case "error":
          console.error(msg.error);
          this.app.setToken(null);
          this.app.appui.showLoginButton();
          return this.app.app_state.initState();
        case "token_valid":
          this.app.nick = msg.nick;
          this.setToken(this.token); // refresh cookie
          this.app.user = {
            nick: msg.nick,
            email: msg.email,
            flags: msg.flags,
            settings: msg.settings,
            info: msg.info
          };
          if ((msg.notifications != null) && msg.notifications.length > 0) {
            ref = msg.notifications;
            for (i = 0, len1 = ref.length; i < len1; i++) {
              n = ref[i];
              this.app.appui.showNotification(n);
            }
          }
          this.app.connected = true;
          this.app.userConnected(msg.nick);
          return this.app.app_state.initState();
      }
    });
  }

  connect() {
    this.socket = new WebSocket(window.location.origin.replace("http", "ws"));
    this.extend();
    this.socket.onmessage = (msg) => {
      var c, err;
      msg = msg.data;
      try {
        // console.info "received: "+msg
        msg = JSON.parse(msg);
        if (msg.request_id != null) {
          if (this.pending_requests[msg.request_id] != null) {
            c = this.pending_requests[msg.request_id];
            delete this.pending_requests[msg.request_id];
            return c(msg);
          }
        } else {
          if ((msg.name != null) && (this.listeners[msg.name] != null)) {
            this.listeners[msg.name](msg);
          }
          return this.app.serverMessage(msg);
        }
      } catch (error) {
        err = error;
        return console.error(err);
      }
    };
    this.socket.onopen = () => {
      var s;
      this.checkToken();
      while (this.sends.length > 0) {
        s = this.sends.splice(0, 1)[0];
        this.send(s);
      }
    };
    return this.socket.onclose = () => {
      console.info("socket closed");
      return this.socket = null;
    };
  }

  extend() {
    return this.timeout = Date.now() + 10000;
  }

  send(data) {
    if ((this.socket != null) && this.socket.readyState === WebSocket.OPEN) {
      this.extend();
      return this.socket.send(JSON.stringify(data));
    } else {
      this.sends.push(data);
      if ((this.socket == null) || this.socket.readyState !== WebSocket.CONNECTING) {
        return this.connect();
      }
    }
  }

  sendRequest(msg, callback) {
    // r = Math.random()
    // if @socket? and msg.name == "write_project_file" and r<.5
    //   console.info("BAD CONNECTION SIMULATED "+r)
    //   @socket.close()
    //   return
    msg.request_id = this.request_id++;
    this.pending_requests[msg.request_id] = callback;
    return this.send(msg);
  }

  sendUpload(msg, data, callback, progress_callback) {
    var request_id;
    request_id = this.request_id;
    return this.sendRequest({
      name: "upload_request",
      size: data.byteLength,
      request: msg
    }, (response) => {
      var count, funk;
      count = 0;
      if (response.name === "error") {
        return callback(response);
      }
      funk = (res) => {
        var buffer, len;
        if ((res != null) && res.name === "error") {
          return callback(res);
        }
        if (progress_callback != null) {
          progress_callback(count / data.byteLength * 100);
        }
        this.pending_requests[request_id] = funk; //(res)=> setTimeout((()=>funk(res)),200)
        len = Math.min(100000, data.byteLength - count);
        if (len > 0) {
          buffer = new ArrayBuffer(len + 4);
          new Uint8Array(buffer, 4, len).set(new Uint8Array(data, count, len));
          count += len;
          new DataView(buffer).setUint32(0, request_id, true);
          console.info(`sending ${len} bytes`);
          return this.socket.send(buffer);
        } else {
          console.info(res);
          return callback(res);
        }
      };
      return funk();
    });
  }

  check() {}

  //if @socket and @socket.readyState == "open" and Date.now()>@timeout
  //  @socket.close()
  listen(name, callback) {
    return this.listeners[name] = callback;
  }

};

this.ConfirmDialog = {
  confirm: function(message, ok, cancel, callback, dismiss) {
    if (ConfirmDialog.window == null) {
      ConfirmDialog.window = new ConfirmDialogWindow;
    }
    return ConfirmDialog.window.show(message, ok, cancel, callback, dismiss);
  }
};

this.ConfirmDialogWindow = class ConfirmDialogWindow {
  constructor() {
    this.overlay = document.getElementById("confirm-message-overlay");
    this.text = document.getElementById("confirm-message-text");
    this.ok = document.getElementById("confirm-message-ok");
    this.cancel = document.getElementById("confirm-message-cancel");
    this.ok.addEventListener("click", () => {
      return this.okPressed();
    });
    this.cancel.addEventListener("click", () => {
      return this.cancelPressed();
    });
  }

  show(message, ok, cancel, callback1, dismiss1) {
    this.callback = callback1;
    this.dismiss = dismiss1;
    if (document.fullscreenElement != null) {
      document.fullscreenElement.appendChild(this.overlay);
    } else {
      document.body.appendChild(this.overlay);
    }
    this.text.innerHTML = message;
    this.ok.innerText = ok;
    this.cancel.innerText = cancel;
    return this.overlay.style.display = "block";
  }

  okPressed() {
    this.overlay.style.display = "none";
    if (this.callback != null) {
      this.callback();
      return this.callback = null;
    }
  }

  cancelPressed() {
    this.overlay.style.display = "none";
    if (this.dismiss != null) {
      this.dismiss();
      return this.dismiss = null;
    }
  }

};

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

this.RegexLib = {
  email: /^([a-zA-Z0-9_\-\.]+)@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.)|(([a-zA-Z0-9\-]+\.)+))([a-zA-Z]{2,25}|[0-9]{1,3})(\]?)$/,
  nick: /^[a-zA-Z0-9_]{5,30}$/,
  filename: /^[a-z0-9_]{1,30}$/,
  slug: /^[a-zA-Z0-9_]{1,30}$/,
  csscolor: /^(#[0-9A-Fa-f]{3,6})|(hsl\(\d+,\d+%,\d+%\))|(rgb\(\d+,\d+,\d+\))$/,
  slugify: function(text) {
    return text.normalize('NFD').replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
  },
  fixFilename: function(text) {
    return text.normalize('NFD').replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
  },
  fixFilePath: function(text) {
    var i, j, len, s, t;
    while (text.startsWith("/")) {
      text = text.substring(1);
    }
    while (text.endsWith("/")) {
      text = text.substring(0, text.length - 1);
    }
    t = text.split("/");
    for (i = j = 0, len = t.length; j < len; i = ++j) {
      s = t[i];
      t[i] = RegexLib.fixFilename(s);
    }
    return t.join("/");
  },
  fixNick: function(text) {
    return text.normalize('NFD').replace(/[^a-zA-Z0-9_]/g, "");
  }
};

if (typeof module !== "undefined" && module !== null) {
  module.exports = this.RegexLib;
}

this.InputValidator = (function() {
  function InputValidator(fields, button, error, callback) {
    var f, j, len, ref;
    this.fields = fields;
    this.button = button;
    this.error = error;
    this.callback = callback;
    if (!Array.isArray(this.fields)) {
      this.fields = [this.fields];
    }
    this.initial = [];
    ref = this.fields;
    for (j = 0, len = ref.length; j < len; j++) {
      f = ref[j];
      this.initial.push(f.value);
      f.addEventListener("input", (function(_this) {
        return function() {
          return _this.change();
        };
      })(this));
      f.addEventListener("keydown", (function(_this) {
        return function(event) {
          if (event.key === "Enter") {
            return _this.validate();
          } else if (event.key === "Escape" && _this.auto_reset) {
            return _this.reset();
          }
        };
      })(this));
    }
    this.button.addEventListener("click", (function(_this) {
      return function() {
        return _this.validate();
      };
    })(this));
    this.button.style.width = 0;
    if (this.error != null) {
      this.error.style.width = 0;
    }
    this.error_timeout = null;
    this.change_timeout = null;
    this.accept_initial = false;
    this.auto_reset = true;
  }

  InputValidator.prototype.set = function(values) {
    var f, i, j, len, ref;
    if (!Array.isArray(values)) {
      values = [values];
    }
    this.initial = [];
    ref = this.fields;
    for (i = j = 0, len = ref.length; j < len; i = ++j) {
      f = ref[i];
      this.initial.push(f.value = values[i]);
    }
  };

  InputValidator.prototype.reset = function() {
    var f, i, j, len, ref;
    ref = this.fields;
    for (i = j = 0, len = ref.length; j < len; i = ++j) {
      f = ref[i];
      f.value = this.initial[i];
      f.blur();
    }
    return this.button.style.width = "0px";
  };

  InputValidator.prototype.update = function() {
    var f, i, j, len, ref;
    ref = this.fields;
    for (i = j = 0, len = ref.length; j < len; i = ++j) {
      f = ref[i];
      this.initial[i] = f.value;
    }
    return this.button.style.width = "0px";
  };

  InputValidator.prototype.check = function() {
    var f, j, len, ref;
    if (this.regex == null) {
      return true;
    }
    ref = this.fields;
    for (j = 0, len = ref.length; j < len; j++) {
      f = ref[j];
      if (!this.regex.test(f.value)) {
        return false;
      }
    }
    return true;
  };

  InputValidator.prototype.change = function() {
    var change, f, i, j, len, ref;
    if (this.error != null) {
      this.error.style.width = 0;
    }
    change = this.accept_initial;
    ref = this.fields;
    for (i = j = 0, len = ref.length; j < len; i = ++j) {
      f = ref[i];
      if (f.value !== this.initial[i]) {
        change = true;
      }
    }
    if (change && this.check()) {
      this.button.style.removeProperty("width");
      if (this.change_timeout != null) {
        clearTimeout(this.change_timeout);
      }
      if (this.auto_reset) {
        return this.change_timeout = setTimeout(((function(_this) {
          return function() {
            _this.reset();
            return _this.change_timeout = null;
          };
        })(this)), 10000);
      }
    } else {
      return this.button.style.width = "0px";
    }
  };

  InputValidator.prototype.cancelChange = function() {
    return this.button.style.width = 0;
  };

  InputValidator.prototype.showError = function(text) {
    if (this.error == null) {
      return;
    }
    this.error.innerText = text;
    this.error.style.width = "auto";
    if (this.error_timeout) {
      clearTimeout(this.error_timeout);
    }
    return this.error_timeout = setTimeout(((function(_this) {
      return function() {
        _this.error.style.width = "0";
        return _this.error_timeout = null;
      };
    })(this)), 5000);
  };

  InputValidator.prototype.validate = function() {
    var f;
    if (this.change_timeout != null) {
      clearTimeout(this.change_timeout);
    }
    this.callback((function() {
      var j, len, ref, results;
      ref = this.fields;
      results = [];
      for (j = 0, len = ref.length; j < len; j++) {
        f = ref[j];
        results.push(f.value);
      }
      return results;
    }).call(this));
    return this.button.style.width = "0px";
  };

  return InputValidator;

})();

this.Translator = (function() {
  function Translator(app) {
    var index;
    this.app = app;
    this.lang = document.children[0].lang;
    this.language = window.translation;
    this.incomplete = {};
    if ((document.cookie != null) && document.cookie.indexOf("language=") >= 0) {
      index = document.cookie.indexOf("language=") + "language=".length;
      this.lang = document.cookie.substring(index, index + 2);
    }
    setInterval(((function(_this) {
      return function() {
        return _this.check();
      };
    })(this)), 5000);
  }

  Translator.prototype.load = function(callback) {
    if (this.language != null) {
      return;
    }
    return this.app.client.sendRequest({
      name: "get_language",
      language: this.lang
    }, (function(_this) {
      return function(msg) {
        var err;
        try {
          _this.language = JSON.parse(msg.language);
        } catch (error) {
          err = error;
        }
        if (callback != null) {
          return callback();
        }
      };
    })(this));
  };

  Translator.prototype.get = function(text) {
    var value;
    if (this.language != null) {
      value = this.language[text];
      if (value == null) {
        this.incomplete[text] = true;
        return text;
      } else {
        return value;
      }
    } else {
      return text;
    }
  };

  Translator.prototype.check = function() {
    var text;
    if ((this.app.user != null) && (this.app.user.flags != null) && this.app.user.flags.admin) {
      if (!this.list_fetched) {
        this.list_fetched = true;
        this.app.client.sendRequest({
          name: "get_translation_list"
        }, (function(_this) {
          return function(msg) {
            return _this.list = msg.list;
          };
        })(this));
      }
      if (this.list != null) {
        for (text in this.incomplete) {
          if (this.list[text] == null) {
            this.app.client.sendRequest({
              name: "add_translation",
              source: text
            });
            this.list[text] = true;
          }
        }
      }
    }
  };

  Translator.prototype.translatorLanguage = function() {
    var key, ref, translator, value;
    translator = false;
    ref = this.app.user.flags;
    for (key in ref) {
      value = ref[key];
      if (key.startsWith("translator_") && value) {
        return key.split("-")[1];
      }
    }
    return null;
  };

  return Translator;

})();

this.Manager = (function() {
  function Manager(app) {
    this.app = app;
  }

  Manager.prototype.init = function() {
    var create_asset, create_folder;
    this.folder_view = new FolderView(this, document.getElementById(this.item + "list"));
    this.folder_view.init();
    this.splitbar = new SplitBar(this.main_splitpanel || (this.folder + "-section"), "horizontal");
    this.splitbar.initPosition(20);
    create_asset = document.querySelector("#" + this.item + "-asset-bar .create-asset-button");
    create_folder = document.querySelector("#" + this.item + "-asset-bar .create-folder-button");
    create_asset.addEventListener("click", (function(_this) {
      return function() {
        return _this.createAsset(_this.folder_view.selected_folder);
      };
    })(this));
    create_folder.addEventListener("click", (function(_this) {
      return function() {
        var f, parent;
        parent = _this.folder_view.selected_folder || _this.folder_view.folder;
        f = parent.createEmptyFolder();
        f["protected"] = true;
        _this.rebuildList();
        _this.folder_view.setSelectedFolder(f);
        return _this.folder_view.editFolderName(f);
      };
    })(this));
    document.getElementById(this.item + "-name").disabled = true;
    this.name_validator = new InputValidator(document.getElementById(this.item + "-name"), document.getElementById(this.item + "-name-button"), null, (function(_this) {
      return function(value) {
        var item, name, old;
        if (!_this.selected_item) {
          return;
        }
        item = _this.app.project[_this.get_item](_this.selected_item);
        if (item == null) {
          return;
        }
        if (_this.app.project.isLocked(_this.folder + "/" + item.name + "." + item.ext)) {
          return;
        }
        _this.app.project.lockFile(_this.folder + "/" + item.name + "." + item.ext);
        name = value[0].toLowerCase();
        name = RegexLib.fixFilename(name);
        document.getElementById(_this.item + "-name").value = name;
        _this.name_validator.update();
        if (name !== item.shortname && RegexLib.filename.test(name) && (_this.app.project[_this.get_item](item.path_prefix + name) == null)) {
          old = _this.selected_item;
          _this.selected_item = item.path_prefix + name;
          return _this.app.client.sendRequest({
            name: "rename_project_file",
            project: _this.app.project.id,
            source: _this.folder + "/" + old + "." + item.ext,
            dest: _this.folder + "/" + (item.path_prefix + name) + "." + item.ext,
            thumbnail: _this.use_thumbnails
          }, function(msg) {
            item.rename(item.path_prefix + name);
            _this.app.project[_this.update_list]();
            if (_this.selectedItemRenamed != null) {
              return _this.selectedItemRenamed();
            } else {
              return _this.setSelectedItem(item.name);
            }
          });
        } else {
          return document.getElementById(_this.item + "-name").value = item.shortname;
        }
      };
    })(this));
    this.name_validator.regex = RegexLib.filename;
    return document.getElementById("delete-" + this.item).addEventListener("click", (function(_this) {
      return function() {
        return _this.deleteItem();
      };
    })(this));
  };

  Manager.prototype.renameItem = function(item, name) {
    return this.app.client.sendRequest({
      name: "rename_project_file",
      project: this.app.project.id,
      source: this.folder + "/" + item.filename,
      dest: this.folder + "/" + name + "." + item.ext,
      thumbnail: this.use_thumbnails
    }, (function(_this) {
      return function(msg) {
        return _this.app.project[_this.update_list]();
      };
    })(this));
  };

  Manager.prototype.update = function() {
    return this.splitbar.update();
  };

  Manager.prototype.projectOpened = function() {
    this.app.project.addListener(this);
    this.setSelectedItem(null);
    return this.folder_view.setSelectedFolder(null);
  };

  Manager.prototype.projectUpdate = function(change) {
    if (change === this.list_change_event) {
      return this.rebuildList();
    } else if (change === "locks") {
      return this.updateActiveUsers();
    }
  };

  Manager.prototype.rebuildList = function() {
    this.folder_view.rebuildList(this.app.project[this.item + "_folder"]);
    this.updateActiveUsers();
    if ((this.selected_item != null) && (this.app.project[this.get_item](this.selected_item) == null)) {
      this.setSelectedItem(null);
    }
  };

  Manager.prototype.updateActiveUsers = function(folder) {
    var e, f, i, j, len, len1, lock, ref, ref1;
    if (folder == null) {
      folder = this.app.project[this.item + "_folder"];
    }
    ref = folder.subfolders;
    for (i = 0, len = ref.length; i < len; i++) {
      f = ref[i];
      this.updateActiveUsers(f);
    }
    ref1 = folder.files;
    for (j = 0, len1 = ref1.length; j < len1; j++) {
      f = ref1[j];
      lock = this.app.project.isLocked(this.folder + "/" + f.filename);
      e = f.element;
      if (e != null) {
        if ((lock != null) && Date.now() < lock.time) {
          e.querySelector(".active-user").style = "display: block; background: " + (this.app.appui.createFriendColor(lock.user)) + ";";
        } else {
          e.querySelector(".active-user").style = "display: none;";
        }
      }
    }
  };

  Manager.prototype.openItem = function(name) {
    var item;
    item = this.app.project[this.get_item](name);
    if (item != null) {
      return this.setSelectedItem(name);
    }
  };

  Manager.prototype.setSelectedItem = function(item) {
    this.selected_item = item;
    this.folder_view.setSelectedItem(item);
    if (this.selected_item != null) {
      document.getElementById(this.item + "-name").disabled = false;
      item = this.app.project[this.get_item](this.selected_item);
      document.getElementById(this.item + "-name").value = item != null ? item.shortname : "";
      this.name_validator.update();
      if (item != null) {
        document.getElementById(this.item + "-name").disabled = (item.canBeRenamed != null) && !item.canBeRenamed();
        document.getElementById("delete-" + this.item).style.display = (item.canBeRenamed != null) && !item.canBeRenamed() ? "none" : "inline-block";
      }
      if ((item != null) && item.uploading) {
        return document.getElementById(this.item + "-name").disabled = true;
      }
    } else {
      document.getElementById(this.item + "-name").value = "";
      return document.getElementById(this.item + "-name").disabled = true;
    }
  };

  Manager.prototype.checkNameFieldActivation = function() {
    var item;
    if (!this.selected_item) {
      return;
    }
    item = this.app.project[this.get_item](this.selected_item);
    if (item != null) {
      return document.getElementById(this.item + "-name").disabled = item.uploading ? true : false;
    }
  };

  Manager.prototype.deleteItem = function() {
    var a, text;
    if (this.selected_item != null) {
      a = this.app.project[this.get_item](this.selected_item);
      if ((a != null) && (a.canBeRenamed == null) || a.canBeRenamed()) {
        if (this.app.project.isLocked(this.folder + "/" + a.name + "." + a.ext)) {
          return;
        }
        this.app.project.lockFile(this.folder + "/" + a.name + "." + a.ext);
        text = this.app.translator.get("Do you really want to delete %ITEM%?").replace("%ITEM%", this.selected_item.replace(/-/g, "/"));
        return ConfirmDialog.confirm(text, this.app.translator.get("Delete"), this.app.translator.get("Cancel"), (function(_this) {
          return function() {
            return _this.app.client.sendRequest({
              name: "delete_project_file",
              project: _this.app.project.id,
              file: a.file,
              thumbnail: _this.use_thumbnails
            }, function(msg) {
              _this.app.project[_this.update_list]();
              _this.setSelectedItem(null);
              if (_this.selectedItemDeleted != null) {
                return _this.selectedItemDeleted();
              }
            });
          };
        })(this));
      }
    }
  };

  Manager.prototype.findNewFilename = function(name, getter, folder) {
    var count, path;
    name = RegexLib.fixFilename(name);
    if (name.length > 30) {
      name = name.substring(0, 30);
    }
    path = folder != null ? folder.getFullDashPath() + "-" + name : name;
    if (this.app.project[getter](path)) {
      count = 2;
      while (this.app.project[getter](path + count)) {
        count += 1;
      }
      name = name + count;
    }
    return name;
  };

  Manager.prototype.deleteFolder = function(folder) {
    if (!folder.containsFiles()) {
      return folder["delete"]();
    } else {
      return ConfirmDialog.confirm(this.app.translator.get("Do you really want to delete this folder and all its contents?"), this.app.translator.get("Delete"), this.app.translator.get("Cancel"), (function(_this) {
        return function() {
          var f, files, i, len;
          console.info("Deleting " + folder.name);
          folder["protected"] = false;
          files = folder.getAllFiles();
          for (i = 0, len = files.length; i < len; i++) {
            f = files[i];
            _this.app.client.sendRequest({
              name: "delete_project_file",
              project: _this.app.project.id,
              file: f.file,
              thumbnail: _this.use_thumbnails
            }, function(msg) {
              _this.app.project[_this.update_list]();
              return _this.setSelectedItem(null);
            });
          }
          if (folder.parent != null) {
            folder.parent.removeFolder(folder);
          }
        };
      })(this));
    }
  };

  return Manager;

})();

var indexOf = [].indexOf;

this.FolderView = class FolderView {
  constructor(manager, panel) {
    this.manager = manager;
    this.panel = panel;
    this.editable = true;
    this.app = this.manager.app;
  }

  isDroppable(event) {
    var i, j, len, ref;
    ref = event.dataTransfer.items;
    for (j = 0, len = ref.length; j < len; j++) {
      i = ref[j];
      if (i.kind === "file") {
        return true;
      } else if (i.kind === "string") {
        if (i.type !== "application/json") {
          return false;
        } else {
          return true;
        }
      }
    }
    return false;
  }

  init() {
    var count;
    this.panel.addEventListener("mousedown", () => {
      return this.setSelectedFolder(null);
    });
    if (this.editable && (this.manager.fileDropped != null)) {
      this.panel.addEventListener("dragover", (event) => {
        if (this.isDroppable(event)) {
          return event.preventDefault();
        }
      });
      this.panel.addEventListener("drop", (event) => {
        var err, ext, file, i, j, len, list, ref, results, split;
        event.preventDefault();
        this.panel.classList.remove("dragover");
        try {
          list = [];
          ref = event.dataTransfer.items;
          results = [];
          for (j = 0, len = ref.length; j < len; j++) {
            i = ref[j];
            list.push(i.getAsFile());
            if (i.kind === "file") {
              file = i.getAsFile();
              split = file.name.split(".");
              ext = split[split.length - 1].toLowerCase();
              if (indexOf.call(this.manager.extensions, ext) >= 0) {
                results.push(this.manager.fileDropped(file));
              } else {
                results.push(void 0);
              }
            } else if (i.kind === "string") {
              results.push(i.getAsString((s) => {
                var data, err, name;
                console.info(s);
                try {
                  data = JSON.parse(s);
                  if (data.type === this.manager.item && (this.drag_file != null)) {
                    if (this.drag_file.parent !== this.folder) {
                      name = this.manager.findNewFilename(this.drag_file.shortname, this.manager.get_item);
                      return this.manager.renameItem(this.drag_file, name);
                    }
                  } else if (data.type === "folder" && (this.drag_folder != null)) {
                    return this.moveFolder(this.drag_folder, this.folder);
                  }
                } catch (error) {
                  err = error;
                  return console.error(err);
                }
              }));
            } else {
              results.push(void 0);
            }
          }
          return results;
        } catch (error) {
          err = error;
          return console.error(err);
        }
      });
      count = 0;
      this.panel.addEventListener("dragenter", (event) => {
        count += 1;
        this.panel.classList.add("dragover");
        return this.setSelectedFolder(null);
      });
      return this.panel.addEventListener("dragleave", (event) => {
        count -= 1;
        if (count === 0) {
          return this.panel.classList.remove("dragover");
        }
      });
    }
  }

  moveFolder(folder, dest) {
    var f, j, len, ref;
    ref = dest.subfolders;
    for (j = 0, len = ref.length; j < len; j++) {
      f = ref[j];
      if (f.name === folder.name) {
        return;
      }
    }
    dest.addFolder(folder);
    return this.fixFilesPath(folder);
  }

  fixFilesPath(folder) {
    var f, j, k, len, len1, name, ref, ref1;
    ref = folder.subfolders;
    for (j = 0, len = ref.length; j < len; j++) {
      f = ref[j];
      this.fixFilesPath(f);
    }
    ref1 = folder.files;
    for (k = 0, len1 = ref1.length; k < len1; k++) {
      f = ref1[k];
      name = folder.getFullDashPath() + "-" + f.shortname;
      this.manager.renameItem(f, name);
    }
  }

  createItemBox(item) {
    var activeuser, element, icon, text;
    element = document.createElement("div");
    element.classList.add("asset-box");
    element.classList.add(`asset-box-${this.manager.item}`);
    item.element = element;
    element.dataset.id = item.name;
    element.setAttribute("title", item.shortname);
    if (item.name === this.selected_item) {
      element.classList.add("selected");
    }
    if (item.getThumbnailURL != null) {
      icon = new Image;
      icon.src = item.getThumbnailURL();
      icon.loading = "lazy";
      icon.setAttribute("id", `asset-image-${item.name}`);
      element.appendChild(icon);
      icon.draggable = false;
    } else if (item.getThumbnailElement != null) {
      icon = item.getThumbnailElement();
      //icon.setAttribute "id","asset-image-#{item.name}"
      element.appendChild(icon);
      icon.draggable = false;
    }
    text = document.createElement("div");
    text.classList.add("asset-box-name");
    if (this.manager.file_icon != null) {
      text.innerHTML = `<i class="${this.manager.file_icon}"></i> ${item.shortname}`;
    } else {
      text.innerHTML = item.shortname;
    }
    element.appendChild(text);
    element.addEventListener("click", () => {
      return this.manager.openItem(item.name);
    });
    activeuser = document.createElement("i");
    activeuser.classList.add("active-user");
    activeuser.classList.add("fa");
    activeuser.classList.add("fa-user");
    element.appendChild(activeuser);
    element.draggable = item.canBeRenamed != null ? item.canBeRenamed() : true;
    element.addEventListener("dragstart", (event) => {
      this.drag_file = item;
      return event.dataTransfer.setData("application/json", JSON.stringify({
        type: this.manager.item,
        id: item.name
      }));
    });
    return element;
  }

  setSelectedFolder(folder, current = this.folder) {
    var f, j, len, ref;
    this.selected_folder = folder;
    if (current == null) {
      return;
    }
    if (current.element != null) {
      if (current === folder) {
        current.element.classList.add("selected");
      } else {
        current.element.classList.remove("selected");
      }
    }
    ref = current.subfolders;
    for (j = 0, len = ref.length; j < len; j++) {
      f = ref[j];
      this.setSelectedFolder(folder, f);
    }
  }

  createItemFolder(folder, element) {
    var content, f, fdiv, j, k, len, len1, ref, ref1, title;
    ref = folder.subfolders;
    for (j = 0, len = ref.length; j < len; j++) {
      f = ref[j];
      fdiv = document.createElement("div");
      fdiv.classList.add("folder");
      element.appendChild(fdiv);
      f.setElement(fdiv);
      // del = document.createElement "i"
      // del.classList.add "fa"
      // del.classList.add "fa-trash"
      // del.classList.add "trash"
      // title.appendChild del
      title = document.createElement("div");
      title.classList.add("folder-title");
      title.innerHTML = `<i class="fas fa-trash-alt trash"></i><i class="fa caret"></i><i class="fa folder"></i> <span>${f.name}</span> <i class="fa pencil fa-pencil-alt"></i>`;
      title.addEventListener("resize", () => {
        if (title.getBoundingClientRect().width < 200) {
          return title.querySelector(".trash").style.display = "none";
        } else {
          return title.querySelector(".trash").style.display = "inline-block";
        }
      });
      fdiv.appendChild(title);
      content = document.createElement("div");
      content.classList.add("folder-content");
      fdiv.appendChild(content);
      ((f, fdiv, title) => {
        var count, span, toggle;
        if (this.editable) {
          title.querySelector(".trash").addEventListener("click", () => {
            this.manager.deleteFolder(f);
            return this.setSelectedFolder(null);
          });
          fdiv.addEventListener("mousedown", (event) => {
            event.stopPropagation();
            this.setSelectedFolder(f);
            // this ensures potential active audio preview will stop playing
            return document.body.dispatchEvent(new MouseEvent("mousedown", {}));
          });
          title.draggable = true;
          title.addEventListener("dragstart", (event) => {
            this.drag_folder = f;
            return event.dataTransfer.setData("application/json", JSON.stringify({
              type: "folder",
              id: f.getFullDashPath()
            }));
          });
        }
        toggle = function() {
          return f.setOpen(!f.open);
        };
        title.addEventListener("click", (event) => {
          if (event.clientX < title.getBoundingClientRect().x + 50) {
            return toggle();
          }
        });
        title.addEventListener("dblclick", (event) => {
          return toggle();
        });
        if (this.editable) {
          span = title.querySelector("span");
          span.addEventListener("dblclick", (event) => {
            event.stopPropagation();
            return this.editFolderName(f);
          });
          title.querySelector(".pencil").addEventListener("click", () => {
            return this.editFolderName(f);
          });
          count = 0;
          fdiv.addEventListener("dragenter", (event) => {
            event.stopPropagation();
            count += 1;
            if (!f.element.classList.contains("selected")) {
              this.setSelectedFolder(f);
            }
            if (!f.open) {
              if (f.open_timeout == null) {
                return f.open_timeout = setTimeout((() => {
                  f.setOpen(true);
                  return delete f.open_timeout;
                }), 1000);
              }
            }
          });
          fdiv.addEventListener("dragleave", (event) => {
            event.stopPropagation();
            count -= 1;
            if (count === 0) {
              if (f.open_timeout != null) {
                clearTimeout(f.open_timeout);
                return delete f.open_timeout;
              }
            }
          });
          fdiv.addEventListener("dragover", (event) => {
            if (this.isDroppable(event)) {
              return event.preventDefault();
            }
          });
          return fdiv.addEventListener("drop", (event) => {
            var err, ext, file, i, k, len1, list, ref1;
            event.preventDefault();
            event.stopPropagation();
            try {
              list = [];
              ref1 = event.dataTransfer.items;
              for (k = 0, len1 = ref1.length; k < len1; k++) {
                i = ref1[k];
                if (i.kind === "file") {
                  file = i.getAsFile();
                  ext = file.name.split(".")[1].toLowerCase();
                  if (indexOf.call(this.manager.extensions, ext) >= 0) {
                    this.manager.fileDropped(file, f);
                  }
                } else if (i.kind === "string") {
                  i.getAsString((s) => {
                    var data, err, fullname, name;
                    console.info(s);
                    try {
                      data = JSON.parse(s);
                      if (data.type === this.manager.item && (this.drag_file != null)) {
                        if (this.drag_file.parent !== f) {
                          name = this.manager.findNewFilename(this.drag_file.shortname, this.manager.get_item, f);
                          fullname = f.getFullDashPath() + "-" + name;
                          return this.manager.renameItem(this.drag_file, fullname);
                        }
                      } else if (data.type === "folder" && (this.drag_folder != null)) {
                        if (this.drag_folder !== f && !this.drag_folder.isAncestorOf(f)) {
                          return this.moveFolder(this.drag_folder, f);
                        }
                      }
                    } catch (error) {
                      err = error;
                      return console.error(err);
                    }
                  });
                }
              }
            } catch (error) {
              err = error;
              console.error(err);
            }
          });
        }
      })(f, fdiv, title);
      this.createItemFolder(f, content);
    }
    ref1 = folder.files;
    for (k = 0, len1 = ref1.length; k < len1; k++) {
      f = ref1[k];
      element.appendChild(this.createItemBox(f));
    }
  }

  rebuildList(folder1) {
    var scroll_top;
    this.folder = folder1;
    scroll_top = this.panel.scrollTop;
    this.panel.innerHTML = "";
    this.createItemFolder(this.folder, this.panel);
    //@updateActiveUsers()
    this.panel.scrollTop = scroll_top;
    if (this.selected_folder != null) {
      this.setSelectedFolder(this.selected_folder);
    }
    if (this.selected_item != null) {
      this.setSelectedItem(this.selected_item);
    }
  }

  setSelectedItem(item) {
    var e, j, k, len, len1, list;
    list = this.panel.getElementsByClassName("asset-box");
    this.selected_item = item;
    if (this.selected_item != null) {
      for (j = 0, len = list.length; j < len; j++) {
        e = list[j];
        if (e.dataset.id === item) {
          e.classList.add("selected");
        } else {
          e.classList.remove("selected");
        }
      }
    } else {
      for (k = 0, len1 = list.length; k < len1; k++) {
        e = list[k];
        e.classList.remove("selected");
      }
    }
  }

  editFolderName(folder) {
    var f, files, input, j, k, len, len1, parent, span;
    parent = folder.parent;
    while (parent != null) {
      if (parent.setOpen != null) {
        parent.setOpen(true);
      }
      parent = parent.parent;
    }
    files = folder.getAllFiles();
    for (j = 0, len = files.length; j < len; j++) {
      f = files[j];
      if (this.app.project.isLocked(`${this.manager.folder}/${f.name}.${f.ext}`)) {
        return;
      }
    }
    input = document.createElement("input");
    input.value = folder.name;
    span = folder.element.querySelector("span");
    span.parentNode.replaceChild(input, span);
    for (k = 0, len1 = files.length; k < len1; k++) {
      f = files[k];
      this.app.project.lockFile(`${this.manager.folder}/${f.name}.${f.ext}`);
    }
    input.focus();
    input.addEventListener("dblclick", (event) => {
      return event.stopPropagation();
    });
    input.addEventListener("blur", () => {
      var l, len2, len3, m, name, oldpath, path, results, value;
      input.parentNode.replaceChild(span, input);
      value = RegexLib.fixFilename(input.value);
      if (value !== folder.name) {
        if (RegexLib.filename.test(value) && (folder.parent.getSubFolder(value) == null)) {
          span.innerText = value;
          for (l = 0, len2 = files.length; l < len2; l++) {
            f = files[l];
            f.old_path = f.parent.getFullDashPath() + "-" + f.shortname + "." + f.ext;
          }
          folder.name = value;
          results = [];
          for (m = 0, len3 = files.length; m < len3; m++) {
            f = files[m];
            oldpath = f.old_path;
            name = f.parent.getFullDashPath() + "-" + f.shortname;
            path = name + "." + f.ext;
            f.rename(name);
            results.push(this.app.client.sendRequest({
              name: "rename_project_file",
              project: this.app.project.id,
              source: `${this.manager.folder}/${oldpath}`,
              dest: `${this.manager.folder}/${path}`,
              thumbnail: this.manager.use_thumbnails
            }, (msg) => {
              return this.app.project[this.manager.update_list]();
            }));
          }
          return results;
        }
      }
    });
    return input.addEventListener("keydown", (event) => {
      // @app.project.lockFile "ms/#{source.name}.ms"
      if (event.key === "Enter") {
        event.preventDefault();
        input.blur();
        return false;
      } else {
        return true;
      }
    });
  }

};

this.About = class About {
  constructor(app) {
    this.app = app;
    this.current = "about";
    this.loaded = {};
    this.sections = ["about", "changelog", "terms", "privacy"];
    this.init();
  }

  init() {
    var i, len, ref, results, s;
    ref = this.sections;
    results = [];
    for (i = 0, len = ref.length; i < len; i++) {
      s = ref[i];
      results.push(((s) => {
        return document.getElementById(`about-menu-${s}`).addEventListener("click", () => {
          return this.setSection(s);
        });
      })(s));
    }
    return results;
  }

  setSection(section) {
    var i, len, ref, s;
    this.current = section;
    ref = this.sections;
    for (i = 0, len = ref.length; i < len; i++) {
      s = ref[i];
      if (s === section) {
        document.getElementById(`about-menu-${s}`).classList.add("selected");
      } else {
        document.getElementById(`about-menu-${s}`).classList.remove("selected");
      }
    }
    return this.load(section, (text) => {
      return this.update(text);
    });
  }

  load(section, callback) {
    var ref, req;
    if (this.loaded[section] != null) {
      if (callback != null) {
        callback(this.loaded[section]);
      }
      return;
    }
    req = new XMLHttpRequest();
    req.onreadystatechange = (event) => {
      if (req.readyState === XMLHttpRequest.DONE) {
        if (req.status === 200) {
          this.loaded[section] = req.responseText;
          if (callback != null) {
            return callback(this.loaded[section]);
          }
        }
      }
    };
    if (((ref = this.app.translator.lang) === "fr" || ref === "it" || ref === "pt") && section !== "changelog") {
      req.open("GET", location.origin + `/doc/${this.app.translator.lang}/${section}.md`);
    } else {
      req.open("GET", location.origin + `/doc/en/${section}.md`);
    }
    return req.send();
  }

  update(doc) {
    var e, element, i, len, list;
    element = document.getElementById("about-content");
    element.innerHTML = DOMPurify.sanitize(marked(doc));
    list = element.getElementsByTagName("a");
    for (i = 0, len = list.length; i < len; i++) {
      e = list[i];
      e.target = "_blank";
    }
  }

};

this.Documentation = class Documentation {
  constructor(app) {
    var e, j, k, len1, len2, list;
    this.app = app;
    this.doc = "";
    this.help = {};
    this.suggest = {};
    this.title_elements = [];
    this.sections = {};
    list = document.getElementsByClassName("help-section-category");
    for (j = 0, len1 = list.length; j < len1; j++) {
      e = list[j];
      ((e) => {
        var title;
        title = e.getElementsByClassName("help-section-title")[0];
        return title.addEventListener("click", () => {
          if (e.classList.contains("collapsed")) {
            e.classList.remove("collapsed");
          } else {
            e.classList.add("collapsed");
          }
          return this.updateViewPos();
        });
      })(e);
    }
    list = document.getElementsByClassName("help-section-button");
    for (k = 0, len2 = list.length; k < len2; k++) {
      e = list[k];
      ((e) => {
        return e.addEventListener("click", () => {
          var id, split;
          split = e.id.split("-");
          split.splice(0, 1);
          id = split.join("-");
          return this.setSection(id);
        });
      })(e);
    }
    window.addEventListener("resize", () => {
      return this.updateViewPos();
    });
  }

  stateInitialized() {
    return this.load("API", (src) => {
      this.buildLiveHelp(src, "API");
      if (!this.current_section) {
        return setTimeout((() => {
          return this.setSection("Quickstart", (() => {
            return this.buildLiveHelp(this.doc, "Quickstart");
          }), null, false);
        }), 100);
      } else {
        return this.load("Quickstart", (src) => {
          return this.buildLiveHelp(src, "Quickstart");
        });
      }
    });
  }

  pushState() {
    if (this.current_section) {
      return this.app.app_state.pushState(`documentation.${this.current_section}`, `/documentation/${this.current_section}/`);
    } else {
      return this.app.app_state.pushState("documentation", "/documentation/");
    }
  }

  setSection(id, callback, url, push_state = true) {
    var e, j, len1, list;
    this.current_section = id;
    if (push_state) {
      this.pushState();
    }
    this.load((url != null ? url : id), (doc1) => {
      this.doc = doc1;
      this.update();
      if (callback != null) {
        return callback();
      }
    });
    list = document.getElementsByClassName("help-section-button");
    for (j = 0, len1 = list.length; j < len1; j++) {
      e = list[j];
      ((e) => {
        if (e.id === `documentation-${id}`) {
          e.classList.add("selected");
          return e.parentNode.parentNode.classList.remove("collapsed");
        } else {
          return e.classList.remove("selected");
        }
      })(e);
    }
  }

  load(id = "Quickstart", callback = (function() {}), lang = this.app.translator.lang) {
    var ref1, req, url;
    if (this.sections[id] != null) {
      return callback(this.sections[id]);
    }
    if ((ref1 = !lang) === "fr" || ref1 === "de" || ref1 === "pl" || ref1 === "it" || ref1 === "pt" || ref1 === "ru") {
      lang = "en";
    }
    req = new XMLHttpRequest();
    req.onreadystatechange = (event) => {
      if (req.readyState === XMLHttpRequest.DONE) {
        if (req.status === 200) {
          this.sections[id] = req.responseText;
          return callback(this.sections[id]);
        } else if (lang !== "en") {
          return this.load(id, callback, "en");
        }
      }
    };
    if (id.startsWith("http")) {
      url = id;
    } else {
      url = `/microstudio.wiki/${lang}/${lang}-${id}.md`;
    }
    req.open("GET", url);
    return req.send();
  }

  updateViewPos() {
    var doc, sections;
    sections = document.getElementById("help-sections");
    doc = document.getElementById("help-document");
    return doc.style.top = `${sections.offsetHeight}px`;
  }

  update() {
    var e, element, j, len1, list;
    if (this.doc == null) {
      return;
    }
    element = document.getElementById("documentation");
    marked.setOptions({
      baseUrl: "/microstudio.wiki/",
      headerPrefix: "documentation_"
    });
    element.innerHTML = DOMPurify.sanitize(marked(this.doc));
    list = element.getElementsByTagName("a");
    for (j = 0, len1 = list.length; j < len1; j++) {
      e = list[j];
      e.target = "_blank";
    }
    //lexer = new marked.Lexer({})
    //console.info lexer.lex @doc
    this.buildToc();
    return this.updateViewPos();
  }

  buildToc() {
    var e, element, j, len1, ref1, toc;
    element = document.getElementById("documentation");
    toc = document.getElementById("help-list");
    toc.innerHTML = "";
    ref1 = element.childNodes;
    for (j = 0, len1 = ref1.length; j < len1; j++) {
      e = ref1[j];
      ((e) => {
        var h;
        switch (e.tagName) {
          case "H1":
            h = document.createElement("h1");
            h.innerText = e.innerText;
            h.addEventListener("click", () => {
              return e.scrollIntoView(true, {
                behavior: "smooth"
              });
            });
            return toc.appendChild(h);
          case "H2":
            h = document.createElement("h2");
            h.innerText = e.innerText;
            h.addEventListener("click", () => {
              return e.scrollIntoView(true, {
                behavior: "smooth"
              });
            });
            return toc.appendChild(h);
          case "H3":
            h = document.createElement("h3");
            h.innerText = e.innerText;
            h.addEventListener("click", () => {
              return e.scrollIntoView(true, {
                behavior: "smooth"
              });
            });
            return toc.appendChild(h);
        }
      })(e);
    }
  }

  buildLiveHelp(src, section) {
    var content, current_section, index, line, lines, ref, slugger, tline;
    lines = src.split("\n");
    index = 0;
    current_section = "";
    slugger = new marked.Slugger;
    while (index < lines.length) {
      line = lines[index];
      tline = lines[Math.min(lines.length - 1, index + 1)];
      if (tline.startsWith("# ")) {
        current_section = "documentation_" + slugger.slug(tline.substring(2, tline.length).replace(/\&lt;|\&gt;/g, ""));
      } else if (tline.startsWith("## ")) {
        current_section = "documentation_" + slugger.slug(tline.substring(3, tline.length).replace(/\&lt;|\&gt;/g, ""));
      } else if (tline.startsWith("### ")) {
        current_section = "documentation_" + slugger.slug(tline.substring(4, tline.length).replace(/\&lt;|\&gt;/g, ""));
      } else if (tline.startsWith("#### ")) {
        current_section = "documentation_" + slugger.slug(tline.substring(5, tline.length).replace(/\&lt;|\&gt;/g, ""));
      } else if (tline.startsWith("##### ")) {
        current_section = "documentation_" + slugger.slug(tline.substring(6, tline.length).replace(/\&lt;|\&gt;/g, ""));
      }
      if (line.indexOf("help_start") > 0) {
        ref = line.substring(line.indexOf("help_start") + 11, line.indexOf("--->"));
        ref = ref.trim();
        index += 1;
        content = "";
        while (index < lines.length) {
          line = lines[index];
          if (line.indexOf("help_end") > 0) {
            this.help[ref] = {
              pointer: current_section,
              value: content,
              section: section
            };
            break;
          } else {
            content += line + "\n";
          }
          index += 1;
        }
      }
      if (line.indexOf("suggest_start") > 0) {
        ref = line.substring(line.indexOf("suggest_start") + "suggest_start".length + 1, line.indexOf("--->"));
        ref = ref.trim();
        index += 1;
        content = "";
        while (index < lines.length) {
          line = lines[index];
          if (line.indexOf("suggest_end") > 0) {
            this.suggest[ref] = {
              pointer: current_section,
              value: content,
              section: section
            };
            break;
          } else {
            content += line + "\n";
          }
          index += 1;
        }
      }
      index++;
    }
  }

  findSuggestMatch(line, position = 0) {
    var best, err, i, index, j, k, key, known_prefixes, l, len, len1, len2, len3, len4, m, n, o, p, prefixes, q, r, ref1, ref2, ref3, ref4, ref5, res, s, split, table, v, value, within;
    res = [];
    best = 0;
    ref1 = this.suggest;
    for (key in ref1) {
      value = ref1[key];
      for (len = j = ref2 = key.length; j >= 3; len = j += -1) {
        index = line.indexOf(key.substring(0, len));
        if (index >= 0) {
          if (index > 0 && line.charAt(index - 1) !== " ") {
            continue;
          }
          best = Math.max(best, len);
          res.push({
            ref: key,
            radix: key.substring(0, len),
            value: value.value,
            pointer: value.pointer,
            index: index,
            within: index <= position && position <= index + len
          });
          break;
        }
      }
    }
    within = false;
    for (k = 0, len1 = res.length; k < len1; k++) {
      r = res[k];
      if (r.ref === r.radix && r.radix.length === best && r.index + r.radix.length < line.length) {
        return [r];
      }
      within = within || r.within;
    }
    if (within) {
      for (i = l = ref3 = res.length - 1; l >= 0; i = l += -1) {
        r = res[i];
        if (!r.within) {
          res.splice(i, 1);
        }
      }
    }
    best = 0;
    for (m = 0, len2 = res.length; m < len2; m++) {
      r = res[m];
      best = Math.max(best, r.radix.length);
    }
    for (i = n = ref4 = res.length - 1; n >= 0; i = n += -1) {
      r = res[i];
      if (r.radix.length < best) {
        res.splice(i, 1);
      }
    }
    if (res.length > 20) {
      try {
        known_prefixes = ["set", "get", "draw", "fill"];
        prefixes = {};
        for (o = 0, len3 = res.length; o < len3; o++) {
          v = res[o];
          split = v.ref.split(".");
          for (q = 0, len4 = known_prefixes.length; q < len4; q++) {
            p = known_prefixes[q];
            if ((split[1] != null) && split[1].startsWith(p)) {
              v.ref = `${split[0]}.${p}...`;
            }
          }
        }
        table = {};
        for (i = s = ref5 = res.length - 1; s >= 0; i = s += -1) {
          v = res[i];
          if (table[v.ref] != null) {
            res.splice(i, 1);
          } else {
            table[v.ref] = v;
          }
        }
      } catch (error) {
        err = error;
        console.error(err);
      }
    }
    return res;
  }

  findHelpMatch(line) {
    var key, ref1, res, value;
    res = [];
    ref1 = this.help;
    for (key in ref1) {
      value = ref1[key];
      if (line.indexOf(key) >= 0) {
        res.push(value);
      }
    }
    return res;
  }

  getPluginsSection() {
    var help_sections, plugins_section;
    help_sections = document.getElementById("help-sections");
    plugins_section = document.getElementById("help-plugins");
    if (plugins_section == null) {
      plugins_section = document.createElement("div");
      plugins_section.classList.add("help-section-category");
      //plugins_section.classList.add "collapsed"
      plugins_section.classList.add("bg-green");
      plugins_section.id = "help-plugins";
      help_sections.appendChild(plugins_section);
      plugins_section.innerHTML = `<div class="help-section-title">\n  <i class="fa"></i><span>${this.app.translator.get("Plug-ins")}</span>\n</div>\n<div class="help-section-content"></div>`;
      plugins_section.querySelector(".help-section-title").addEventListener("click", () => {
        if (plugins_section.classList.contains("collapsed")) {
          plugins_section.classList.remove("collapsed");
        } else {
          plugins_section.classList.add("collapsed");
        }
        return this.updateViewPos();
      });
    }
    return plugins_section;
  }

  addPlugin(id, title, link) {
    var doc, plugins_section;
    id = `documentation-${id}`;
    if (!document.getElementById(id)) {
      plugins_section = this.getPluginsSection();
      doc = document.createElement("div");
      doc.id = id;
      doc.classList.add("help-section-button");
      doc.innerText = title;
      plugins_section.querySelector(".help-section-content").appendChild(doc);
      doc.addEventListener("click", () => {
        return this.setSection(link);
      });
      return this.updateViewPos();
    }
  }

  removePlugin(id) {
    var element, parent;
    id = `documentation-${id}`;
    element = document.getElementById(id);
    if (element != null) {
      parent = element.parentNode;
      parent.removeChild(element);
      if (parent.childNodes.length === 0) {
        this.removeAllPlugins();
      }
      return this.updateViewPos();
    }
  }

  removeAllPlugins() {
    var plugins_section;
    plugins_section = document.getElementById("help-plugins");
    if (plugins_section != null) {
      plugins_section.parentNode.removeChild(plugins_section);
      return this.updateViewPos();
    }
  }

  getLibsSection() {
    var help_sections, libs_section;
    help_sections = document.getElementById("help-sections");
    libs_section = document.getElementById("help-libraries");
    if (libs_section == null) {
      libs_section = document.createElement("div");
      libs_section.classList.add("help-section-category");
      //libs_section.classList.add "collapsed"
      libs_section.classList.add("bg-purple");
      libs_section.id = "help-libraries";
      help_sections.appendChild(libs_section);
      libs_section.innerHTML = `<div class="help-section-title">\n  <i class="fa"></i><span>${this.app.translator.get("Libraries in use")}</span>\n</div>\n<div class="help-section-content"></div>`;
      libs_section.querySelector(".help-section-title").addEventListener("click", () => {
        if (libs_section.classList.contains("collapsed")) {
          libs_section.classList.remove("collapsed");
        } else {
          libs_section.classList.add("collapsed");
        }
        return this.updateViewPos();
      });
    }
    return libs_section;
  }

  addLib(id, title, link) {
    var doc, libs_section;
    id = `documentation-${id}`;
    if (!document.getElementById(id)) {
      libs_section = this.getLibsSection();
      doc = document.createElement("div");
      doc.id = id;
      doc.classList.add("help-section-button");
      doc.innerText = title;
      libs_section.querySelector(".help-section-content").appendChild(doc);
      doc.addEventListener("click", () => {
        return this.setSection(link);
      });
      return this.updateViewPos();
    }
  }

  removeLib(id) {
    var element, parent;
    id = `documentation-${id}`;
    element = document.getElementById(id);
    if (element != null) {
      parent = element.parentNode;
      parent.removeChild(element);
      if (parent.childNodes.length === 0) {
        this.removeAllLibs();
      }
      return this.updateViewPos();
    }
  }

  removeAllLibs() {
    var libs_section;
    libs_section = document.getElementById("help-libraries");
    if (libs_section != null) {
      libs_section.parentNode.removeChild(libs_section);
      return this.updateViewPos();
    }
  }

};

this.DocEditor = (function() {
  function DocEditor(app) {
    this.app = app;
    this.editor = ace.edit("doc-editor");
    this.editor.$blockScrolling = 2e308;
    this.editor.setTheme("ace/theme/tomorrow_night_bright");
    this.editor.getSession().setMode("ace/mode/markdown");
    this.editor.setFontSize("14px");
    this.editor.session.setOptions({
      tabSize: 2,
      useSoftTabs: true
    });
    this.save_delay = 3000;
    this.save_time = 0;
    setInterval(((function(_this) {
      return function() {
        return _this.checkSave();
      };
    })(this)), this.save_delay / 2);
    this.editor.getSession().on("change", (function(_this) {
      return function() {
        return _this.editorContentsChanged();
      };
    })(this));
    document.getElementById("doceditor-start-tutorial").addEventListener("click", (function(_this) {
      return function() {
        var p, url;
        p = _this.app.project;
        if (p["public"]) {
          url = location.origin + ("/tutorial/" + p.owner.nick + "/" + p.slug + "/");
        } else {
          url = location.origin + ("/tutorial/" + p.owner.nick + "/" + p.slug + "/" + p.code + "/");
        }
        return window.open(url, "_blank");
      };
    })(this));
  }

  DocEditor.prototype.editorContentsChanged = function() {
    var e, el, i, len, list, src;
    src = this.editor.getValue();
    e = document.getElementById("doc-render");
    e.innerHTML = DOMPurify.sanitize(marked(src));
    list = e.getElementsByTagName("a");
    for (i = 0, len = list.length; i < len; i++) {
      el = list[i];
      el.target = "_blank";
    }
    if (this.ignore_changes) {
      return;
    }
    this.app.project.addPendingChange(this);
    this.save_time = Date.now();
    return this.checkTutorial();
  };

  DocEditor.prototype.checkSave = function(immediate, callback) {
    if (this.save_time > 0 && (immediate || Date.now() > this.save_time + this.save_delay)) {
      this.saveDoc(callback);
      return this.save_time = 0;
    }
  };

  DocEditor.prototype.forceSave = function(callback) {
    return this.checkSave(true, callback);
  };

  DocEditor.prototype.saveDoc = function(callback) {
    var saved;
    saved = false;
    this.app.client.sendRequest({
      name: "write_project_file",
      project: this.app.project.id,
      file: "doc/doc.md",
      content: this.editor.getValue()
    }, (function(_this) {
      return function(msg) {
        saved = true;
        if (_this.save_time === 0) {
          _this.app.project.removePendingChange(_this);
        }
        if (callback != null) {
          return callback();
        }
      };
    })(this));
    return setTimeout(((function(_this) {
      return function() {
        if (!saved) {
          _this.save_time = Date.now();
          return console.info("retrying doc save...");
        }
      };
    })(this)), 10000);
  };

  DocEditor.prototype.setDoc = function(doc) {
    this.ignore_changes = true;
    this.editor.setValue(doc, -1);
    this.ignore_changes = false;
    this.editor.getSession().setUndoManager(new ace.UndoManager());
    return this.checkTutorial();
  };

  DocEditor.prototype.checkTutorial = function() {
    if ((this.app.project != null) && this.app.project.type === "tutorial") {
      return document.getElementById("doceditor-start-tutorial").style.display = "block";
    } else {
      return document.getElementById("doceditor-start-tutorial").style.display = "none";
    }
  };

  return DocEditor;

})();

var indexOf = [].indexOf;

this.Editor = class Editor extends Manager {
  constructor(app) {
    var f;
    super(app);
    this.language = this.app.languages.microscript;
    this.folder = "ms";
    this.item = "source";
    this.main_splitpanel = "code-editor";
    this.list_change_event = "sourcelist";
    this.get_item = "getSource";
    this.use_thumbnails = false;
    this.extensions = ["ms"];
    this.update_list = "updateSourceList";
    this.file_icon = "fa fa-file";
    this.init();
    this.editor = ace.edit("editor-view");
    this.editor.$blockScrolling = 2e308;
    this.editor.setTheme("ace/theme/tomorrow_night_bright");
    this.editor.getSession().setMode(this.language.ace_mode);
    this.editor.setFontSize("14px");
    this.editor.getSession().setOptions({
      tabSize: 2,
      useSoftTabs: true,
      useWorker: false // disables lua autocorrection ; preserves syntax coloring
    });
    //enableBasicAutocompletion: true
    //enableSnippets: true
    //enableLiveAutocompletion: true
    this.update_delay = 50;
    this.update_time = 0;
    setInterval((() => {
      return this.check();
    }), this.update_delay / 2);
    this.save_delay = 3000;
    this.save_time = 0;
    setInterval((() => {
      return this.checkSave();
    }), this.save_delay / 2);
    this.keydown_count = 0;
    this.lines_of_code = 0;
    this.editor.getSession().on("change", () => {
      return this.editorContentsChanged();
    });
    this.editor.on("blur", () => {
      this.app.runwindow.rulercanvas.hide();
      return document.getElementById("help-window").classList.add("disabled");
    });
    this.editor.on("focus", () => {
      this.checkValueToolButtons();
      this.cancelValueTool();
      if (this.show_help) {
        document.getElementById("help-window").classList.remove("disabled");
        return this.liveHelp();
      }
    });
    this.RULER_FUNCTIONS = ["fillRect", "fillRound", "fillRoundRect", "drawRect", "drawRound", "drawRoundRect", "drawSprite", "drawMap", "drawText", "drawLine", "drawPolygon", "fillPolygon"];
    this.number_tool_button = document.getElementById("number-value-tool-button");
    this.color_tool_button = document.getElementById("color-value-tool-button");
    this.number_tool_button.addEventListener("click", (event) => {
      event.preventDefault();
      if (this.value_tool) {
        return this.cancelValueTool();
      } else {
        return this.showValueTool();
      }
    });
    this.color_tool_button.addEventListener("click", (event) => {
      event.preventDefault();
      if (this.value_tool) {
        return this.cancelValueTool();
      } else {
        return this.showValueTool();
      }
    });
    this.editor.selection.on("changeCursor", () => {
      this.liveHelp();
      if (this.value_tool == null) {
        this.drawHelper();
      }
      return this.checkValueToolButtons();
    });
    this.show_help = true;
    document.querySelector("#help-window-content").addEventListener("mousedown", (event) => {
      event.stopPropagation();
      this.show_help = !this.show_help;
      event.preventDefault();
      if (!this.show_help) {
        document.querySelector("#help-window").classList.add("disabled");
        return document.querySelector("#help-window-content").classList.remove("displaycontent");
      } else {
        document.querySelector("#help-window").classList.remove("disabled");
        this.liveHelp();
        return this.editor.focus();
      }
    });
    document.addEventListener("keydown", (event) => {
      var err;
      try {
        if (event.keyCode === 13 && this.editor.getSelectionRange().start.column > 1) {
          this.lines_of_code += 1;
        } else if (event.keyCode !== 13) {
          this.keydown_count += 1;
        }
      } catch (error) {
        err = error;
        console.error(err);
      }
      if (event.keyCode !== 17 && event.ctrlKey) {
        this.cancelValueTool();
        this.ignore_ctrl_up = true;
      }
    });
    document.addEventListener("keyup", (event) => {
      if (document.getElementById("editor-view").offsetParent == null) {
        return;
      }
      if (event.keyCode === 17 && !event.altKey) {
        if (this.ignore_ctrl_up) {
          this.ignore_ctrl_up = false;
          return;
        }
        if (this.value_tool) {
          this.cancelValueTool();
        } else {
          this.showValueTool();
        }
      }
    });
    document.querySelector("#code-search").addEventListener("click", (event) => {
      return this.editor.execCommand("find");
    });
    this.font_size = 14;
    this.MIN_FONT_SIZE = 8;
    this.MAX_FONT_SIZE = 30;
    f = localStorage.getItem("code_editor_font_size");
    if (f != null) {
      try {
        f = parseInt(f);
        if (f >= this.MIN_FONT_SIZE && f < this.MAX_FONT_SIZE) {
          this.font_size = f;
          this.editor.setOptions({
            fontSize: this.font_size
          });
        }
      } catch (error) {}
    }
    document.querySelector("#code-font-minus").addEventListener("click", (event) => {
      this.font_size = Math.max(this.MIN_FONT_SIZE, this.font_size - 1);
      this.editor.setOptions({
        fontSize: this.font_size
      });
      return localStorage.setItem("code_editor_font_size", this.font_size);
    });
    document.querySelector("#code-font-plus").addEventListener("click", (event) => {
      this.font_size = Math.min(this.MAX_FONT_SIZE, this.font_size + 1);
      this.editor.setOptions({
        fontSize: this.font_size
      });
      return localStorage.setItem("code_editor_font_size", this.font_size);
    });
    this.lib_manager_button = document.querySelector("#manage-libs-button");
    this.lib_manager = document.querySelector(".lib-manager-container");
    this.editor_view = document.querySelector("#editor-view");
    this.lib_manager_button.addEventListener("click", () => {
      return this.toggleLibManager();
    });
  }

  updateLanguage() {
    if (this.app.project) {
      switch (this.app.project.language) {
        case "python":
          this.language = this.app.languages.python;
          break;
        case "javascript":
          this.language = this.app.languages.javascript;
          break;
        case "lua":
          this.language = this.app.languages.lua;
          break;
        case "microscript_v2":
          this.language = this.app.languages.microscript2;
          break;
        default:
          this.language = this.app.languages.microscript;
      }
    }
    this.editor.getSession().setMode(this.language.ace_mode);
    return this.updateSourceLanguage();
  }

  checkEmbeddedJavaScript(src) {
    if (this.app.project.language === "microscript_v2") {
      if (/^\s*\/\/\s*javascript\s*\n/.test(src)) {
        if (this.language !== this.app.languages.javascript) {
          this.language = this.app.languages.javascript;
          return this.editor.getSession().setMode(this.language.ace_mode);
        }
      } else {
        if (this.language !== this.app.languages.microscript2) {
          this.language = this.app.languages.microscript2;
          return this.editor.getSession().setMode(this.language.ace_mode);
        }
      }
    }
  }

  editorContentsChanged() {
    var source, src;
    if (this.ignore_changes) {
      return;
    }
    src = this.editor.getValue();
    this.checkEmbeddedJavaScript(src);
    this.update_time = Date.now();
    this.save_time = Date.now();
    this.app.project.addPendingChange(this);
    if (this.selected_source != null) {
      this.app.project.lockFile(`ms/${this.selected_source}.ms`);
      source = this.app.project.getSource(this.selected_source);
      if (source != null) {
        source.content = this.getCode();
      }
    }
    if (this.value_tool == null) {
      return this.drawHelper();
    }
  }

  check() {
    var p, parser;
    if (this.update_time > 0 && (this.value_tool || Date.now() > this.update_time + this.update_delay)) {
      this.update_time = 0;
      if (this.language.parser) {
        parser = new this.language.parser(this.editor.getValue());
        p = parser.parse();
        if (parser.error_info == null) {
          return this.app.runwindow.updateCode(this.selected_source + ".ms", this.getCode());
        }
      } else {
        return this.app.runwindow.updateCode(this.selected_source + ".ms", this.getCode());
      }
    }
  }

  getCurrentLine() {
    var range, row;
    range = this.editor.getSelectionRange();
    row = range.start.row;
    return this.editor.session.getLine(row);
  }

  checkSave(immediate = false, callback) {
    if (this.save_time > 0 && (immediate || Date.now() > this.save_time + this.save_delay)) {
      this.saveCode(callback);
      return this.save_time = 0;
    }
  }

  forceSave(callback) {
    return this.checkSave(true, callback);
  }

  saveCode(callback) {
    var keycount, lines, saved, source;
    source = this.app.project.getSource(this.selected_source);
    saved = false;
    lines = this.lines_of_code;
    keycount = this.keydown_count;
    this.keydown_count = 0;
    this.lines_of_code = 0;
    this.app.client.sendRequest({
      name: "write_project_file",
      project: this.app.project.id,
      file: `ms/${this.selected_source}.ms`,
      characters: keycount,
      lines: lines,
      content: this.getCode()
    }, (msg) => {
      saved = true;
      if (this.save_time === 0) {
        this.app.project.removePendingChange(this);
      }
      if (source) {
        source.size = msg.size;
      }
      if (callback != null) {
        return callback();
      }
    });
    return setTimeout((() => {
      if (!saved) {
        this.save_time = Date.now();
        return console.info("retrying code save...");
      }
    }), 10000);
  }

  getCode() {
    return this.editor.getValue();
  }

  setCode(code) {
    this.ignore_changes = true;
    this.editor.setValue(code, -1);
    this.editor.getSession().setUndoManager(new ace.UndoManager());
    this.ignore_changes = false;
    this.updateCurrentFileLock();
    return this.checkEmbeddedJavaScript(code);
  }

  addDocButton(pointer, section) {
    var button, content;
    content = document.querySelector("#help-window .content");
    button = document.createElement("div");
    button.classList.add("see-doc-button");
    button.innerHTML = "<i class='fa fa-book-open'></i> " + this.app.translator.get("View doc");
    button.addEventListener("mousedown", (event) => {
      var element;
      event.stopPropagation();
      this.app.documentation.setSection(section || "API");
      this.app.appui.setMainSection("help", true);
      element = document.getElementById(pointer);
      if (element != null) {
        return element.scrollIntoView();
      }
    });
    return content.insertBefore(button, content.firstChild);
  }

  liveHelp() {
    var c, column, content, help, j, len, line, md, res, suggest;
    if (!this.show_help) {
      return;
    }
    line = this.getCurrentLine().replace(":", ".");
    column = this.editor.getSelectionRange().start.column;
    suggest = this.app.documentation.findSuggestMatch(line, column);
    content = document.querySelector("#help-window .content");
    if (suggest.length === 0) {
      help = this.app.documentation.findHelpMatch(line);
      if (help.length > 0) {
        content.innerHTML = DOMPurify.sanitize(marked(help[0].value));
        document.querySelector("#help-window").classList.add("showing");
        this.addDocButton(help[0].pointer, help[0].section);
      } else {
        content.innerHTML = "";
        c = document.querySelector("#help-window-content");
        c.classList.remove("displaycontent");
        return;
      }
    } else if (suggest.length === 1) {
      content.innerHTML = DOMPurify.sanitize(marked(suggest[0].value));
      document.querySelector("#help-window").classList.add("showing");
      this.addDocButton(suggest[0].pointer, suggest[0].section);
    } else {
      md = "";
      for (j = 0, len = suggest.length; j < len; j++) {
        res = suggest[j];
        md += res.ref + "\n\n";
      }
      content.innerHTML = DOMPurify.sanitize(marked(md));
      document.querySelector("#help-window").classList.add("showing");
      this.addDocButton(suggest[0].pointer, suggest[0].section);
    }
    c = document.querySelector("#help-window-content");
    if (window.innerWidth < 800) {
      c.style["max-width"] = (window.innerWidth - 120) + "px";
    } else {
      c.style["max-width"] = "unset";
    }
    if (this.app.appui.code_splitbar.type === "vertical") {
      c.classList.add("displaycontent");
      return c.classList.add("vertical");
    } else {
      c.classList.add("displaycontent");
      return c.classList.remove("vertical");
    }
  }

  tokenizeLine(line) {
    var err, index, list, token, tokenizer;
    tokenizer = new Tokenizer(line.replace(":", "."));
    index = 0;
    list = [];
    try {
      while (true) {
        token = tokenizer.next();
        if (token == null) {
          break;
        }
        list.push({
          token: token,
          start: index,
          end: tokenizer.index
        });
        index = tokenizer.index;
      }
    } catch (error) {
      err = error;
    }
    return list;
  }

  checkValueToolButtons() {
    var column, index, j, len, line, list, range, ref, row, token;
    range = this.editor.getSelectionRange();
    row = range.start.row;
    column = range.start.column;
    line = this.editor.session.getLine(row);
    list = this.tokenizeLine(line);
    for (index = j = 0, len = list.length; j < len; index = ++j) {
      token = list[index];
      if (column >= token.start && column <= token.end && ((ref = token.token.type) === Token.TYPE_NUMBER || ref === Token.TYPE_STRING)) {
        break;
      }
      if (column >= token.start && column <= token.end && token.token.type === Token.TYPE_MINUS && index < list.length - 1) {
        if (list[index + 1].token.type === Token.TYPE_NUMBER) {
          index += 1;
          token = list[index];
          break;
        }
      }
    }
    if (token != null) {
      switch (token.token.type) {
        case Token.TYPE_NUMBER:
          this.color_tool_button.style.display = "none";
          this.number_tool_button.style.display = "inline-block";
          return;
        case Token.TYPE_STRING:
          if (RegexLib.csscolor.test(token.token.value)) {
            this.color_tool_button.style.display = "inline-block";
            this.number_tool_button.style.display = "none";
            return;
          }
      }
    }
    this.color_tool_button.style.display = "none";
    return this.number_tool_button.style.display = "none";
  }

  hideValueToolButtons() {
    this.color_tool_button.style.display = "none";
    return this.number_tool_button.style.display = "none";
  }

  showValueTool() {
    var column, end, endcolumn, index, j, len, line, list, pos, range, ref, ref1, row, start, start_token, token, value;
    if (this.value_tool != null) {
      return;
    }
    this.cancelValueTool();
    range = this.editor.getSelectionRange();
    row = range.start.row;
    if (range.end.row !== range.start.row) {
      return;
    }
    column = range.start.column;
    endcolumn = range.end.column;
    line = this.editor.session.getLine(row);
    list = this.tokenizeLine(line);
    for (index = j = 0, len = list.length; j < len; index = ++j) {
      token = list[index];
      if (column >= token.start && column <= token.end && ((ref = token.token.type) === Token.TYPE_NUMBER || ref === Token.TYPE_STRING)) {
        start = token.start;
        end = token.end;
        break;
      }
      if (column >= token.start && column <= token.end && token.token.type === Token.TYPE_MINUS && index < list.length - 1) {
        if (list[index + 1].token.type === Token.TYPE_NUMBER) {
          start = token.start;
          index += 1;
          token = list[index];
          end = token.end;
          break;
        }
      }
    }
    if ((token != null) && column >= start && endcolumn <= end) {
      switch (token.token.type) {
        case Token.TYPE_NUMBER:
          value = token.token.value;
          start_token = token;
          if (index > 0 && list[index - 1].token.type === Token.TYPE_MINUS && (index < 2 || ((ref1 = list[index - 2].token.type) !== Token.TYPE_NUMBER && ref1 !== Token.TYPE_IDENTIFIER && ref1 !== Token.TYPE_CLOSED_BRACE && ref1 !== Token.TYPE_CLOSED_BRACKET))) {
            value = -value;
            start_token = list[index - 1];
          }
          start = line.substring(0, start_token.start);
          end = line.substring(token.end, line.length);
          pos = this.editor.renderer.$cursorLayer.getPixelPosition(range.start, true);
          //@editor.selection.setRange(new ace.Range(row,start_token.start,row,token.end),true)
          this.editor.blur();
          this.value_tool = new ValueTool(this, pos.left, pos.top, value, (value) => {
            this.editor.session.replace({
              start: {
                row: row,
                column: 0
              },
              end: {
                row: row,
                column: Number.MAX_VALUE
              }
            }, start + value + end);
            this.editor.selection.setRange(new ace.Range(row, start_token.start, row, start_token.start + ("" + value).length), true);
            return this.drawHelper(row, column);
          });
          return true;
        case Token.TYPE_STRING:
          if (RegexLib.csscolor.test(token.token.value)) {
            start = line.substring(0, token.start);
            end = line.substring(token.end, line.length);
            pos = this.editor.renderer.$cursorLayer.getPixelPosition(range.start, true);
            this.editor.blur();
            this.value_tool = new ColorValueTool(this, pos.left, pos.top, token.token.value, (value) => {
              value = `"${value}"`;
              return this.editor.session.replace({
                start: {
                  row: row,
                  column: 0
                },
                end: {
                  row: row,
                  column: Number.MAX_VALUE
                }
              }, start + value + end);
            });
            return true;
          }
      }
    }
    return false;
  }

  cancelValueTool() {
    if (this.value_tool) {
      this.value_tool.dispose();
      this.value_tool = null;
      this.app.runwindow.rulercanvas.hide();
      return this.editor.focus();
    }
  }

  evalArg(arg, callback) {
    if (document.getElementById("runiframe") != null) {
      return this.app.runwindow.runCommand(arg, callback);
    } else {
      return callback(isFinite(arg) ? arg * 1 : 0);
    }
  }

  drawHelper(row, column) {
    var args, err, funk, i, j, ref, res;
    try {
      res = this.analyzeLine(row, column);
      if (res != null) {
        if (this.app.project.language.startsWith("microscript")) {
          if (res.function.indexOf("Polygon") > 0 || res.function === "drawLine") {
            args = [];
            funk = (i) => {
              return this.evalArg(res.args[i], (v) => {
                args[i] = v;
                if (i < res.args.length - 1) {
                  return funk(i + 1);
                } else {
                  return this.app.runwindow.rulercanvas.showPolygon(args, res.arg);
                }
              });
            };
            return funk(0);
          } else {
            return this.evalArg(res.args[0], (v1) => {
              return this.evalArg(res.args[1], (v2) => {
                return this.evalArg(res.args[2], (v3) => {
                  return this.evalArg(res.args[3], (v4) => {
                    switch (res.arg) {
                      case 0:
                        return this.app.runwindow.rulercanvas.showX(v1, v2, v3, v4);
                      case 1:
                        return this.app.runwindow.rulercanvas.showY(v1, v2, v3, v4);
                      case 2:
                        return this.app.runwindow.rulercanvas.showW(v1, v2, v3, v4);
                      case 3:
                        return this.app.runwindow.rulercanvas.showH(v1, v2, v3, v4);
                      default:
                        return this.app.runwindow.rulercanvas.showBox(v1, v2, v3, v4);
                    }
                  });
                });
              });
            });
          }
        } else {
          if (res.function.indexOf("Polygon") > 0 || res.function === "drawLine") {
            args = res.args;
            return this.app.runwindow.rulercanvas.showPolygon(args, res.arg);
          } else {
            args = res.args;
            for (i = j = 0, ref = args.length - 1; j <= ref; i = j += 1) {
              args[i] = args[i] | 0;
            }
            switch (res.arg) {
              case 0:
                return this.app.runwindow.rulercanvas.showX(args[0], args[1], args[2], args[3]);
              case 1:
                return this.app.runwindow.rulercanvas.showY(args[0], args[1], args[2], args[3]);
              case 2:
                return this.app.runwindow.rulercanvas.showW(args[0], args[1], args[2], args[3]);
              case 3:
                return this.app.runwindow.rulercanvas.showH(args[0], args[1], args[2], args[3]);
              default:
                return this.app.runwindow.rulercanvas.showBox(args[0], args[1], args[2], args[3]);
            }
          }
        }
      } else {
        return this.app.runwindow.rulercanvas.hide();
      }
    } catch (error) {
      err = error;
      return console.error(err);
    }
  }

  analyzeLine(row, column) {
    var a, arg, arg_value, args, f, i, j, len, line, p, parser, range, ref, ref1, ref2;
    range = this.editor.getSelectionRange();
    if ((row == null) || (column == null)) {
      row = range.start.row;
      column = range.start.column;
    }
    line = this.editor.session.getLine(row);
    parser = new Parser(line.replace(":", ".") + " ");
    p = parser.parse();
    if (parser.last_function_call != null) {
      f = parser.last_function_call;
      if ((f.expression.expression != null) && f.expression.expression.identifier === "screen" && (f.expression.chain != null) && (f.expression.chain[0] != null) && (ref = f.expression.chain[0].value, indexOf.call(this.RULER_FUNCTIONS, ref) >= 0)) {
        arg = -1;
        args = ["0", "0", "20", "20"];
        ref1 = f.argslimits;
        for (i = j = 0, len = ref1.length; j < len; i = ++j) {
          a = ref1[i];
          if (column >= a.start && column <= a.end) {
            arg = i;
          }
          arg_value = line.substring(a.start, a.end);
          if (arg_value.trim().length > 0) {
            args[i] = arg_value;
          }
        }
        if ((ref2 = f.expression.chain[0].value) === "drawSprite" || ref2 === "drawMap" || ref2 === "drawText") {
          args.splice(0, 1);
          arg -= 1;
          if (f.argslimits.length < 5 && f.expression.chain[0].value !== "drawText") {
            args[3] = args[2];
          }
        }
        if (f.expression.chain[0].value === "drawText") {
          args[3] = args[2];
          args[2] = args[2] * 4 + "";
          if (arg >= 2) {
            arg += 1;
          }
        }
        if (f.expression.chain[0].value.indexOf("Polygon") > 0 || f.expression.chain[0].value === "drawLine") {
          while (args.length > Math.max(2, f.argslimits.length)) {
            args.splice(args.length - 1, 1);
          }
        }
        return {
          function: f.expression.chain[0].value,
          arg: arg,
          value: arg_value,
          args: args
        };
      }
    }
    return null;
  }

  updateSourceLanguage() {
    var element, lang;
    lang = this.app.project.language.split("_")[0];
    element = document.querySelector("#source-asset-bar .language");
    element.innerText = lang;
    element.className = "";
    element.classList.add(lang);
    return element.classList.add("language");
  }

  // document.getElementById("code-toolbar").innerHTML += "<span class='language #{lang}'>#{lang}</span>"
  setSelectedItem(name) {
    this.setSelectedSource(name);
    return super.setSelectedItem(name);
  }

  setSelectedSource(name) {
    var different, source;
    this.toggleLibManager(false);
    this.checkSave(true);
    if (this.selected_source != null) {
      this.sessions[this.selected_source] = {
        range: this.editor.getSelectionRange()
      };
    }
    different = name !== this.selected_source;
    this.selected_source = name;
    if (this.selected_source != null) {
      this.updateSourceLanguage();
    }
    if (this.selected_source != null) {
      source = this.app.project.getSource(this.selected_source);
      this.setCode(source.content);
      this.updateCurrentFileLock();
      this.updateAnnotations();
      if (this.sessions[this.selected_source] && different) {
        this.editor.selection.setRange(this.sessions[this.selected_source].range);
        this.editor.revealRange(this.sessions[this.selected_source].range);
        return this.editor.focus();
      }
    } else {
      return this.setCode("");
    }
  }

  projectOpened() {
    super.projectOpened();
    this.sessions = {};
    this.app.project.addListener(this);
    this.app.runwindow.resetButtons();
    this.app.runwindow.windowResized();
    this.setSelectedItem(null);
    this.updateRunLink();
    this.updateLanguage();
    return this.update();
  }

  projectUpdate(change) {
    super.projectUpdate(change);
    if (change instanceof ProjectSource) {
      if (this.selected_source != null) {
        if (change === this.app.project.getSource(this.selected_source)) {
          return this.setCode(change.content);
        }
      }
    } else if (change === "locks") {
      this.updateCurrentFileLock();
      return this.updateActiveUsers();
    } else if (change === "code" || change === "public" || change === "slug") {
      return this.updateRunLink();
    } else if (change === "annotations") {
      return this.updateAnnotations();
    }
  }

  updateAnnotations() {
    var source;
    if (this.selected_source != null) {
      source = this.app.project.getSource(this.selected_source);
      if (source != null) {
        return this.editor.session.setAnnotations(source.annotations || []);
      }
    }
  }

  updateCurrentFileLock() {
    var lock, source, user;
    lock = document.getElementById("editor-locked");
    if (this.selected_source != null) {
      if (this.app.project.isLocked(`ms/${this.selected_source}.ms`)) {
        this.editor.setReadOnly(true);
        user = this.app.project.isLocked(`ms/${this.selected_source}.ms`).user;
        return this.showLock(`<i class='fa fa-user'></i> Locked by ${user}`, this.app.appui.createFriendColor(user));
      } else {
        source = this.app.project.getSource(this.selected_source);
        if ((source != null) && !source.fetched) {
          this.editor.setReadOnly(true);
          return this.showLock("<i class=\"fas fa-spinner fa-spin\"></i> " + this.app.translator.get("Loading..."), "hsl(200,50%,50%)");
        } else {
          this.hideLock();
          return this.editor.setReadOnly(false);
        }
      }
    } else {
      this.hideLock();
      return this.editor.setReadOnly(true);
    }
  }

  showLock(html, color) {
    var lock;
    lock = document.getElementById("editor-locked");
    this.lock_shown = true;
    lock.style = `display: block; background: ${color}; opacity: 1`;
    lock.innerHTML = html;
    return document.getElementById("editor-view").style.opacity = .5;
  }

  hideLock() {
    var lock;
    lock = document.getElementById("editor-locked");
    this.lock_shown = false;
    lock.style.opacity = 0;
    document.getElementById("editor-view").style.opacity = 1;
    return setTimeout((() => {
      if (!this.lock_shown) {
        return lock.style.display = "none";
      }
    }), 1000);
  }

  selectedItemRenamed() {
    return this.selected_source = this.selected_item;
  }

  rebuildList() {
    super.rebuildList();
    if ((this.selected_source == null) || (this.app.project.getSource(this.selected_source) == null)) {
      if (this.app.project.source_list.length > 0) {
        return this.setSelectedItem(this.app.project.source_list[0].name);
      }
    }
  }

  fileDropped(file, folder) {
    var reader;
    console.info(`processing ${file.name}`);
    console.info("folder: " + folder);
    reader = new FileReader();
    reader.addEventListener("load", () => {
      var name;
      console.info("file read, size = " + reader.result.length);
      if (reader.result.length > 1000000) {
        return;
      }
      name = file.name.split(".")[0];
      name = RegexLib.fixFilename(name);
      console.info(reader.result);
      return this.createAsset(folder, name, reader.result);
    });
    return reader.readAsText(file);
  }

  createAsset(folder, name = "source", content = "") {
    var source;
    this.checkSave(true);
    if (folder != null) {
      name = folder.getFullDashPath() + `-${name}`;
      folder.setOpen(true);
    }
    source = this.app.project.createSource(name);
    source.content = content;
    name = source.name;
    return this.app.client.sendRequest({
      name: "write_project_file",
      project: this.app.project.id,
      file: `ms/${name}.ms`,
      properties: {},
      content: content
    }, (msg) => {
      console.info(msg);
      this.app.project.updateSourceList();
      return this.setSelectedItem(name);
    });
  }

  updateRunLink() {
    var element, iframe, qrcode, url;
    element = document.getElementById("run-link");
    if (this.app.project != null) {
      url = location.origin.replace(".dev", ".io") + "/";
      url += this.app.project.owner.nick + "/";
      url += this.app.project.slug + "/";
      if (!this.app.project.public) {
        url += this.app.project.code + "/";
      }
      element.innerText = url;
      element.href = url;
      element.title = url;
      iframe = document.querySelector("#device iframe");
      if (iframe != null) {
        iframe.src = url;
      }
      return qrcode = QRCode.toDataURL(url, {
        margin: 0
      }, (err, url) => {
        var img;
        if ((err == null) && (url != null)) {
          img = new Image;
          img.src = url;
          document.getElementById("qrcode-button").innerHTML = "";
          return document.getElementById("qrcode-button").appendChild(img);
        }
      });
    }
  }

  toggleLibManager(view = this.editor_view.style.display !== "none") {
    if (view) {
      this.lib_manager.style.display = "block";
      this.editor_view.style.display = "none";
      return this.lib_manager_button.classList.add("selected");
    } else {
      this.lib_manager.style.display = "none";
      this.editor_view.style.display = "block";
      return this.lib_manager_button.classList.remove("selected");
    }
  }

};

this.RunWindow = class RunWindow {
  constructor(app) {
    this.app = app;
    this.app.appui.setAction("run-button", () => {
      return this.play();
    });
    this.app.appui.setAction("pause-button", () => {
      return this.pause();
    });
    this.app.appui.setAction("reload-button", () => {
      return this.reload();
    });
    this.app.appui.setAction("run-button-win", () => {
      return this.play();
    });
    this.app.appui.setAction("pause-button-win", () => {
      return this.pause();
    });
    this.app.appui.setAction("reload-button-win", () => {
      return this.reload();
    });
    this.app.appui.setAction("detach-button", () => {
      return this.detach();
    });
    this.app.appui.setAction("qrcode-button", () => {
      return this.showQRCode();
    });
    this.app.appui.setAction("take-picture-button", () => {
      return this.takePicture();
    });
    this.app.appui.setAction("step-forward-button", () => {
      return this.stepForward();
    });
    this.app.appui.setAction("step-forward-button-win", () => {
      return this.stepForward();
    });
    if (window.ms_standalone) {
      document.getElementById("qrcode-button").style.display = "none";
    }
    this.app.appui.setAction("clear-button", () => {
      return this.clear();
    });
    this.app.appui.setAction("console-options-button", () => {
      return this.toggleConsoleOptions();
    });
    this.rulercanvas = new RulerCanvas(this.app);
    window.addEventListener("resize", () => {
      return this.windowResized();
    });
    this.terminal = new Terminal(this);
    window.addEventListener("message", (msg) => {
      var iframe;
      iframe = document.getElementById("runiframe");
      if ((iframe != null) && msg.source === iframe.contentWindow) {
        return this.messageReceived(msg.data);
      }
    });
    this.command_table = {};
    this.command_id = 0;
    this.floating_window = new FloatingWindow(this.app, "run-window", this);
    this.floating_window.max_ratio = 1;
    this.initWarnings();
    this.message_listeners = {};
    this.listeners = [];
    this.project_access = new ProjectAccess(this.app, null, this);
    this.server_bar = new ServerBar(this.app);
  }

  initWarnings() {
    document.getElementById("console-options-warning-undefined").addEventListener("change", () => {
      this.warning_undefined = document.getElementById("console-options-warning-undefined").checked;
      return localStorage.setItem("console_warning_undefined", this.warning_undefined);
    });
    document.getElementById("console-options-warning-nonfunction").addEventListener("change", () => {
      this.warning_nonfunction = document.getElementById("console-options-warning-nonfunction").checked;
      return localStorage.setItem("console_warning_nonfunction", this.warning_nonfunction);
    });
    document.getElementById("console-options-warning-assign").addEventListener("change", () => {
      this.warning_assign = document.getElementById("console-options-warning-assign").checked;
      return localStorage.setItem("console_warning_assign", this.warning_assign);
    });
    document.getElementById("console-options-warning-condition").addEventListener("change", () => {
      this.warning_condition = document.getElementById("console-options-warning-condition").checked;
      return localStorage.setItem("console_warning_condition", this.warning_condition);
    });
    this.warning_undefined = localStorage.getItem("console_warning_undefined") === "true" || false;
    this.warning_nonfunction = localStorage.getItem("console_warning_nonfunction") !== "false";
    this.warning_assign = localStorage.getItem("console_warning_assign") !== "false";
    this.warning_condition = localStorage.getItem("console_warning_condition") !== "false";
    document.getElementById("console-options-warning-undefined").checked = this.warning_undefined;
    document.getElementById("console-options-warning-nonfunction").checked = this.warning_nonfunction;
    document.getElementById("console-options-warning-assign").checked = this.warning_assign;
    return document.getElementById("console-options-warning-condition").checked = this.warning_condition;
  }

  detach() {
    var b, device, wincontent;
    if (this.app.project.networking) {
      return new FloatingRunWindow(this.app);
    }
    if (this.detached) {
      return this.floating_window.close();
    } else {
      device = document.getElementById("device");
      if (device != null) {
        this.detached = true;
        document.querySelector("#detach-button i").classList.remove("fa-expand");
        document.querySelector("#detach-button i").classList.add("fa-compress");
        wincontent = document.querySelector("#run-window .content");
        wincontent.innerHTML = "";
        wincontent.appendChild(device);
        wincontent.appendChild(document.getElementById("ruler"));
        b = document.querySelector(".devicecontainer").getBoundingClientRect();
        this.floating_window.resize(b.x - 5, b.y - 45, b.width + 10, b.height + 90);
        this.floating_window.show();
        this.floatingWindowResized();
        return document.getElementById("runtime").style.display = "none";
      }
    }
  }

  floatingWindowResized() {
    return this.windowResized();
  }

  floatingWindowClosed() {
    var container, device;
    if (!this.detached) {
      return;
    }
    this.detached = false;
    device = document.getElementById("device");
    if (device != null) {
      container = document.querySelector(".devicecontainer");
      container.innerHTML = "";
      container.appendChild(device);
      container.appendChild(document.getElementById("ruler"));
      document.querySelector("#detach-button i").classList.add("fa-expand");
      document.querySelector("#detach-button i").classList.remove("fa-compress");
      document.getElementById("runtime").style.display = "block";
      return this.windowResized();
    }
  }

  run() {
    var code, device, origin, src, url;
    src = this.app.editor.editor.getValue();
    origin = `${location.origin.replace(".dev", ".io")}`;
    if (this.app.project.properties && this.app.project.properties.embedder_policy) {
      console.info("replacing origin to .dev");
      origin = origin.replace(".io", ".dev");
    }
    device = document.getElementById("device");
    code = this.app.project.public ? "" : `${this.app.project.code}/`;
    url = `${origin}/${this.app.project.owner.nick}/${this.app.project.slug}/${code}`;
    return this.app.project.savePendingChanges(() => {
      device.innerHTML = `<iframe id='runiframe' allow='autoplay ${origin}; gamepad ${origin}; midi ${origin}; camera ${origin}; microphone ${origin}' src='${url}?debug'></iframe>`;
      //document.getElementById("runiframe").focus()
      this.windowResized();
      return document.getElementById("take-picture-button").style.display = "inline-block";
    });
  }

  reload() {
    this.terminal.clear();
    this.run();
    document.getElementById("run-button").classList.add("selected");
    document.getElementById("pause-button").classList.remove("selected");
    document.getElementById("reload-button").classList.remove("selected");
    document.getElementById("run-button-win").classList.add("selected");
    document.getElementById("pause-button-win").classList.remove("selected");
    document.getElementById("reload-button-win").classList.remove("selected");
    document.getElementById("step-forward-button").style.display = "none";
    document.getElementById("step-forward-button-win").style.display = "none";
    return this.propagate("reload");
  }

  play() {
    if (document.getElementById("runiframe") != null) {
      return this.resume();
    } else {
      this.run();
      document.getElementById("run-button").classList.add("selected");
      document.getElementById("pause-button").classList.remove("selected");
      document.getElementById("reload-button").classList.remove("selected");
      document.getElementById("run-button-win").classList.add("selected");
      document.getElementById("pause-button-win").classList.remove("selected");
      document.getElementById("reload-button-win").classList.remove("selected");
      document.getElementById("step-forward-button").style.display = "none";
      document.getElementById("step-forward-button-win").style.display = "none";
      return this.propagate("play");
    }
  }

  pause() {
    var e;
    e = document.getElementById("runiframe");
    if (e != null) {
      e.contentWindow.postMessage(JSON.stringify({
        name: "pause"
      }), "*");
    }
    document.getElementById("run-button").classList.remove("selected");
    document.getElementById("pause-button").classList.add("selected");
    document.getElementById("reload-button").classList.remove("selected");
    document.getElementById("run-button-win").classList.remove("selected");
    document.getElementById("pause-button-win").classList.add("selected");
    document.getElementById("reload-button-win").classList.remove("selected");
    document.getElementById("step-forward-button").style.display = "inline-block";
    document.getElementById("step-forward-button-win").style.display = "inline-block";
    return this.propagate("pause");
  }

  isPaused() {
    return document.getElementById("pause-button").classList.contains("selected") || document.getElementById("pause-button-win").classList.contains("selected");
  }

  stepForward() {
    return this.postMessage({
      name: "step_forward"
    });
  }

  resume() {
    var e;
    e = document.getElementById("runiframe");
    if (e != null) {
      e.contentWindow.postMessage(JSON.stringify({
        name: "resume"
      }), "*");
      e.contentWindow.focus();
    }
    document.getElementById("run-button").classList.add("selected");
    document.getElementById("pause-button").classList.remove("selected");
    document.getElementById("reload-button").classList.remove("selected");
    document.getElementById("run-button-win").classList.add("selected");
    document.getElementById("pause-button-win").classList.remove("selected");
    document.getElementById("reload-button-win").classList.remove("selected");
    document.getElementById("step-forward-button").style.display = "none";
    document.getElementById("step-forward-button-win").style.display = "none";
    return this.propagate("resume");
  }

  resetButtons() {
    document.getElementById("run-button").classList.remove("selected");
    document.getElementById("pause-button").classList.add("selected");
    document.getElementById("reload-button").classList.add("selected");
    document.getElementById("run-button-win").classList.remove("selected");
    document.getElementById("pause-button-win").classList.add("selected");
    document.getElementById("reload-button-win").classList.add("selected");
    document.getElementById("step-forward-button").style.display = "none";
    return document.getElementById("step-forward-button-win").style.display = "none";
  }

  clear() {
    return this.terminal.clear();
  }

  toggleConsoleOptions() {
    var div;
    div = document.getElementById("console-options");
    if (div.getBoundingClientRect().height <= 41) {
      div.style.height = "145px";
      document.getElementById("terminal-view").style.top = "185px";
    } else {
      div.style.height = "0px";
      document.getElementById("terminal-view").style.top = "40px";
    }
    return setTimeout((() => {
      return this.app.appui.runtime_splitbar.update();
    }), 600);
  }

  updateCode(file, src) {
    var iframe;
    if (this.error_check != null) {
      clearTimeout(this.error_check);
    }
    this.error_buffer = [];
    this.error_check = setTimeout((() => {
      var err, i, len, ref, results;
      this.error_check = null;
      if (this.terminal.error_lines > 0) {
        this.terminal.clear();
      }
      ref = this.error_buffer;
      results = [];
      for (i = 0, len = ref.length; i < len; i++) {
        err = ref[i];
        results.push(this.logError(err));
      }
      return results;
    }), 3000);
    src = this.app.editor.editor.getValue();
    iframe = document.getElementById("runiframe");
    if (iframe != null) {
      return iframe.contentWindow.postMessage(JSON.stringify({
        name: "code_updated",
        file: file,
        code: src
      }), "*");
    }
  }

  updateSprite(name) {
    var data, iframe, properties, sprite;
    iframe = document.getElementById("runiframe");
    if (iframe != null) {
      sprite = this.app.project.getSprite(name);
      if (sprite != null) {
        data = sprite.saveData().split(",")[1];
        properties = {
          frames: sprite.frames.length,
          fps: sprite.fps
        };
        return iframe.contentWindow.postMessage(JSON.stringify({
          name: "sprite_updated",
          file: name,
          data: data,
          properties: properties
        }), "*");
      }
    }
  }

  updateMap(name) {
    var data, iframe, map;
    iframe = document.getElementById("runiframe");
    if (iframe != null) {
      map = this.app.project.getMap(name);
      if (map != null) {
        data = map.save();
        return iframe.contentWindow.postMessage(JSON.stringify({
          name: "map_updated",
          file: name,
          data: data
        }), "*");
      }
    }
  }

  windowResized() {
    var c, ch, cw, h, r, ratio, w;
    r = document.getElementById("device");
    c = document.getElementById("device").firstChild;
    if (this.app.project == null) {
      return;
    }
    cw = r.clientWidth;
    ch = r.clientHeight;
    ratio = {
      "4x3": 4 / 3,
      "16x9": 16 / 9,
      "2x1": 2 / 1,
      "1x1": 1 / 1
    }[this.app.project.aspect];
    //if not ratio? and @app.project.orientation in ["portrait","landscape"]
    //  ratio = 16/9
    if (ratio != null) {
      switch (this.app.project.orientation) {
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
    if (c != null) {
      c.style["margin-top"] = "0px"; //{}Math.round((ch-h)/2)+"px"
      c.style.width = Math.round(cw) + "px";
      c.style.height = Math.round(ch) + "px";
    }
    return this.rulercanvas.resize(Math.round(w), Math.round(h), Math.round((ch - h) / 2));
  }

  logError(err) {
    var error, text;
    if (this.error_check != null) {
      this.error_buffer.push(err);
      return;
    }
    error = err.error;
    switch (err.type) {
      case "non_function":
        if (!this.warning_nonfunction) {
          return;
        }
        error = this.app.translator.get("Warning: %EXP% is not a function").replace("%EXP%", err.expression);
        this.annotateWarning(error, err);
        break;
      case "undefined_variable":
        if (!this.warning_undefined) {
          return;
        }
        error = this.app.translator.get("Warning: %EXP% is not defined, defaulting to zero").replace("%EXP%", err.expression);
        this.annotateWarning(error, err);
        break;
      case "assigning_undefined":
        if (!this.warning_assign) {
          return;
        }
        error = this.app.translator.get("Warning: %EXP% is not defined, will be initialized to an empty object").replace("%EXP%", err.expression);
        this.annotateWarning(error, err);
        break;
      case "assigning_api_variable":
        error = this.app.translator.get("Warning: overwriting global API variable '%EXP%'").replace("%EXP%", err.expression);
        this.annotateWarning(error, err);
        break;
      case "assignment_as_condition":
        if (!this.warning_condition) {
          return;
        }
        error = this.app.translator.get("Warning: assignment in a condition ; to check equality, use '=='");
        this.annotateWarning(error, err);
    }
    if (err.line != null) {
      if (err.file && typeof err.file === "string") {
        err.file = err.file.replace(/\-/g, "/");
        text = this.app.translator.get("%ERROR%, in file \"%FILE%\" at line %LINE%");
        if (err.column) {
          text += ", column %COLUMN%";
        }
        return this.terminal.error(text.replace("%ERROR%", error).replace("%FILE%", err.file).replace("%LINE%", err.line).replace("%COLUMN%", err.column));
      } else {
        return this.terminal.error(error);
      }
    } else {
      return this.terminal.error(`${error}`);
    }
  }

  annotateWarning(warning, info) {
    var source;
    //    if @app.editor.selected_source == info.file
    source = this.app.project.getSource(info.file);
    if (source != null) {
      if (source.annotations == null) {
        source.annotations = [];
      }
      source.annotations.push({
        row: info.line - 1,
        column: info.column - 1,
        type: "warning",
        text: warning
      });
      return this.app.project.notifyListeners("annotations");
    }
  }

  messageReceived(msg) {
    var c, e, err, iframe, source;
    try {
      msg = JSON.parse(msg);
      switch (msg.name) {
        case "error":
          if (msg.data) {
            this.logError(msg.data);
            if (this.app.editor.selected_source === msg.data.file) {
              source = this.app.project.getSource(msg.data.file);
              if ((source != null) && msg.data.error) {
                source.annotations = [
                  {
                    row: msg.data.line - 1,
                    column: msg.data.column - 1,
                    type: "error",
                    text: msg.data.error
                  }
                ];
                return this.app.project.notifyListeners("annotations");
              }
            }
          }
          break;
        // console.info msg.data
        case "compile_success":
          source = this.app.project.getSource(msg.file);
          if (source != null) {
            if ((source.annotations != null) && source.annotations.length > 0) {
              // @terminal.clear()
              source.annotations = [];
              return this.app.project.notifyListeners("annotations");
            }
          }
          break;
        case "log":
          return this.terminal.echo(msg.data);
        case "output":
          if (msg.data != null) {
            if (msg.id && (this.command_table[msg.id] != null)) {
              c = this.command_table[msg.id];
              this.command_table[msg.id] = null;
              return c(msg.data);
            } else {
              return this.terminal.echo(msg.data);
            }
          }
          break;
        case "focus":
          e = document.getElementById("runiframe");
          if (e != null) {
            return e.contentWindow.focus();
          }
          break;
        case "picture_taken":
          return this.showPicture(msg.data);
        case "code_paused":
          return this.pause();
        case "exit":
          return this.exit();
        case "started":
          this.propagate("started");
          if (this.pending_command != null) {
            iframe = document.getElementById("runiframe");
            if (iframe != null) {
              if (this.pending_command.output_callback != null) {
                this.command_table[this.command_id] = this.pending_command.output_callback;
              }
              iframe.contentWindow.postMessage(JSON.stringify({
                name: "command",
                line: this.pending_command.command,
                id: this.pending_command.output_callback != null ? this.command_id++ : void 0
              }), "*");
            }
            return this.pending_command = null;
          }
          break;
        case "time_machine":
          return this.app.debug.time_machine.messageReceived(msg);
        default:
          if ((msg.name != null) && (this.message_listeners[msg.name] != null)) {
            return this.message_listeners[msg.name](msg);
          } else {
            return this.project_access.messageReceived(msg);
          }
      }
    } catch (error1) {
      err = error1;
    }
  }

  runCommand(command, output_callback) {
    var iframe, parser;
    this.nesting = 0;
    if (command.trim().length === 0) {
      return;
    }
    if ((this.app.project != null) && this.app.project.language.startsWith("microscript")) {
      if (this.multiline != null) {
        this.multiline += "\n" + command;
        command = this.multiline;
      }
      parser = new Parser(command);
      parser.parse();
      if (parser.error_info) {
        this.nesting = parser.nesting;
        if (parser.unexpected_eof) {
          this.multiline = command;
        } else {
          this.multiline = null;
          this.logError(parser.error_info);
        }
        return;
      } else {
        this.nesting = 0;
        this.multiline = null;
      }
    }
    iframe = document.getElementById("runiframe");
    if (iframe != null) {
      if (output_callback != null) {
        this.command_table[this.command_id] = output_callback;
      }
      return iframe.contentWindow.postMessage(JSON.stringify({
        name: "command",
        line: command,
        id: output_callback != null ? this.command_id++ : void 0
      }), "*");
    } else {
      this.pending_command = {
        command: command,
        output_callback: output_callback
      };
      return this.play();
    }
  }

  projectOpened() {
    var iframe;
    iframe = document.getElementById("runiframe");
    if (iframe != null) {
      iframe.parentElement.removeChild(iframe);
    }
    this.terminal.clear();
    this.updateServerBar();
    this.app.appui.server_splitbar.update();
    return this.app.appui.debug_splitbar.update();
  }

  updateServerBar() {
    if ((this.app.project != null) && this.app.project.networking) {
      document.getElementById("runtime").classList.add("server-open");
      document.querySelector("#detach-button i").classList.remove("fa-window-restore");
      document.querySelector("#detach-button i").classList.add("fa-table");
    } else {
      document.getElementById("runtime").classList.remove("server-open");
      document.querySelector("#detach-button i").classList.add("fa-window-restore");
      document.querySelector("#detach-button i").classList.remove("fa-table");
    }
    return this.server_bar.update(this.app.project);
  }

  projectClosed() {
    var i, iframe, len, list, w;
    this.floating_window.close();
    iframe = document.getElementById("runiframe");
    if (iframe != null) {
      iframe.parentElement.removeChild(iframe);
    }
    document.getElementById("take-picture-button").style.display = "none";
    this.hideAll();
    this.server_bar.update(null);
    list = document.querySelectorAll(".fw-run");
    for (i = 0, len = list.length; i < len; i++) {
      w = list[i];
      if (w.parentNode != null) {
        w.parentNode.removeChild(w);
      }
    }
    document.querySelector("#runtime-server-view").innerHTML = "";
    this.app.appui.server_splitbar.closed1 = true;
  }

  hideQRCode() {
    if (this.qrcode != null) {
      document.body.removeChild(this.qrcode);
      return this.qrcode = null;
    }
  }

  showQRCode() {
    var qrcode, url;
    if (this.app.project != null) {
      if (this.qrcode != null) {
        return this.hideQRCode();
      } else {
        url = location.origin.replace(".dev", ".io") + "/";
        url += this.app.project.owner.nick + "/";
        url += this.app.project.slug + "/";
        if (!this.app.project.public) {
          url += this.app.project.code + "/";
        }
        return qrcode = QRCode.toDataURL(url, {
          margin: 2,
          scale: 8
        }, (err, url) => {
          var img;
          if ((err == null) && (url != null)) {
            img = new Image;
            img.src = url;
            return img.onload = () => {
              var b;
              b = document.getElementById("qrcode-button").getBoundingClientRect();
              img.style.position = "absolute";
              img.style.top = `${b.y + b.height + 20}px`;
              img.style.left = `${Math.min(b.x + b.width / 2 - 132, window.innerWidth - img.width - 10)}px`;
              img.style["z-index"] = 20;
              this.qrcode = img;
              this.qrcode.addEventListener("click", () => {
                return this.showQRCode();
              });
              return document.body.appendChild(this.qrcode);
            };
          }
        });
      }
    }
  }

  takePicture() {
    var iframe;
    iframe = document.getElementById("runiframe");
    if (iframe != null) {
      return iframe.contentWindow.postMessage(JSON.stringify({
        name: "take_picture"
      }), "*");
    }
  }

  hidePicture() {
    if (this.picture != null) {
      document.body.removeChild(this.picture);
      return this.picture = null;
    }
  }

  showPicture(data) {
    var b, button, div, img, save_button, set_button;
    this.hidePicture();
    this.picture = div = document.createElement("div");
    div.classList.add("show-picture");
    div.style.position = "absolute";
    b = document.getElementById("take-picture-button").getBoundingClientRect();
    div.style.top = `${b.y + b.height + 20}px`;
    div.style.left = `${Math.min(b.x + b.width / 2 - 180, window.innerWidth - 360 - 10)}px`;
    document.body.appendChild(div);
    img = new Image;
    img.src = data;
    img.style.width = "320px";
    div.appendChild(img);
    div.appendChild(document.createElement("br"));
    save_button = document.createElement("div");
    save_button.innerText = this.app.translator.get("Save");
    save_button.classList.add("save");
    save_button.addEventListener("click", () => {
      return this.savePicture(data, save_button);
    });
    div.appendChild(save_button);
    div.appendChild(document.createElement("br"));
    set_button = document.createElement("div");
    set_button.innerText = this.app.translator.get("Set as project poster image");
    set_button.addEventListener("click", () => {
      return this.setAsPoster(data, set_button);
    });
    div.appendChild(set_button);
    div.appendChild(document.createElement("br"));
    button = document.createElement("div");
    button.innerText = this.app.translator.get("Close");
    button.classList.add("close");
    button.addEventListener("click", () => {
      return this.hidePicture();
    });
    return div.appendChild(button);
  }

  savePicture(data, button) {
    var link;
    link = document.createElement("a");
    link.setAttribute("href", data);
    link.setAttribute("download", `${this.app.project.slug}.png`);
    link.click();
    return button.style.display = "none";
  }

  setAsPoster(data, button) {
    var img;
    button.style.display = "none";
    img = new Image;
    img.src = data;
    return img.onload = () => {
      var canvas, h, ih, iw, poster, r, w;
      canvas = document.createElement("canvas");
      iw = img.width;
      ih = img.height;
      if (iw < ih) {
        h = Math.min(360, ih);
        r = h / ih * 1.2;
        canvas.width = w = h / 9 * 16;
        canvas.height = h;
        canvas.getContext("2d").fillStyle = "#000";
        canvas.getContext("2d").fillRect(0, 0, canvas.width, canvas.height);
        canvas.getContext("2d").drawImage(img, w / 2 - r * img.width / 2, h / 2 - r * img.height / 2, img.width * r, img.height * r);
      } else {
        w = Math.min(640, iw, ih / 9 * 16);
        h = w / 16 * 9;
        r = Math.max(w / img.width, h / img.height);
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, w / 2 - r * img.width / 2, h / 2 - r * img.height / 2, img.width * r, img.height * r);
      }
      data = canvas.toDataURL().split(",")[1];
      poster = this.app.project.getSprite("poster");
      return this.app.client.sendRequest({
        name: "write_project_file",
        project: this.app.project.id,
        file: "sprites/poster.png",
        properties: {
          frames: 1,
          fps: 5
        },
        content: data
      }, (msg) => {
        this.app.project.updateSpriteList();
        if (poster != null) {
          return poster.reload();
        }
      });
    };
  }

  hideAll() {
    this.hideQRCode();
    return this.hidePicture();
  }

  exit() {
    this.projectClosed();
    document.getElementById("run-button").classList.remove("selected");
    document.getElementById("pause-button").classList.remove("selected");
    document.getElementById("reload-button").classList.remove("selected");
    document.getElementById("run-button-win").classList.remove("selected");
    document.getElementById("pause-button-win").classList.remove("selected");
    document.getElementById("reload-button-win").classList.remove("selected");
    return this.propagate("exit");
  }

  postMessage(data) {
    var iframe;
    iframe = document.getElementById("runiframe");
    if (iframe != null) {
      return iframe.contentWindow.postMessage(JSON.stringify(data), "*");
    }
  }

  addMessageListener(name, callback) {
    return this.message_listeners[name] = callback;
  }

  addListener(callback) {
    return this.listeners.push(callback);
  }

  propagate(event) {
    var i, l, len, ref, results;
    ref = this.listeners;
    results = [];
    for (i = 0, len = ref.length; i < len; i++) {
      l = ref[i];
      results.push(l(event));
    }
    return results;
  }

};

this.ServerBar = class ServerBar {
  constructor(app) {
    this.app = app;
    document.getElementById("start-server-button").addEventListener("click", () => {
      return this.startServer(true);
    });
    document.getElementById("start-server-tab-button").addEventListener("click", () => {
      return this.startServer(false);
    });
    document.getElementById("stop-server-button").addEventListener("click", () => {
      return this.stopServer();
    });
  }

  update(project) {
    this.project = project;
    if ((this.project != null) && this.project.networking) {
      if (this.watcher != null) {
        this.watcher.stop();
      }
      this.watcher = new ServerWatcher(this.app, this);
    } else if (this.watcher != null) {
      this.watcher.stop();
      delete this.watcher;
    }
    return this.forced_stop = false;
  }

  setStatus(status, message) {
    if (status === "running" && !this.forced_stop) {
      document.querySelector("#serverbar .status").classList.add("running");
      document.getElementById("start-server-button").style.display = "none";
      document.getElementById("start-server-tab-button").style.display = "none";
      document.getElementById("stop-server-button").style.display = "inline-block";
    } else {
      document.querySelector("#serverbar .status").classList.remove("running");
      document.getElementById("start-server-button").style.display = "inline-block";
      document.getElementById("start-server-tab-button").style.display = "inline-block";
      document.getElementById("stop-server-button").style.display = "none";
    }
    return document.querySelector("#serverbar .status-info").innerText = message;
  }

  startServer(embedded) {
    var iframe, parent, url;
    this.forced_stop = false;
    if (this.app.project != null) {
      url = dev_domain + "/";
      url += this.app.project.owner.nick + "/";
      url += this.app.project.slug + "/";
      if (!this.app.project.public) {
        url += this.app.project.code + "/";
      }
      url += "?server";
      if (!embedded) {
        return this.server_tab = window.open(url);
      } else {
        parent = document.getElementById("runtime-server-view");
        parent.style.overflow = "hidden";
        iframe = `<iframe src="${url}" style="position: absolute ; top: 0 ; left: 0 ; width: 100% ; height: 100% ; border: none ;"></iframe>`;
        parent.innerHTML = iframe;
        this.app.appui.server_splitbar.closed1 = false;
        this.app.appui.server_splitbar.update();
        return this.app.appui.debug_splitbar.update();
      }
    }
  }

  stopServer() {
    document.getElementById("runtime-server-view").innerHTML = "";
    this.app.appui.server_splitbar.closed1 = true;
    this.app.appui.server_splitbar.update();
    this.app.appui.debug_splitbar.update();
    if (this.server_tab != null) {
      this.server_tab.close();
      this.server_tab = null;
    }
    return this.forced_stop = true;
  }

};

this.ServerWatcher = class ServerWatcher {
  constructor(app, server_bar) {
    this.app = app;
    this.server_bar = server_bar;
    this.project = this.app.project;
    this.watch();
    this.interval = setInterval((() => {
      return this.watch();
    }), 1000);
  }

  watch() {
    var err;
    if ((this.socket != null) && this.socket.readyState <= 1) {
      if (this.socket.readyState === 1) {
        return this.sendCheck();
      }
    } else {
      if (this.socket != null) {
        try {
          this.socket.close();
        } catch (error1) {
          err = error1;
        }
        delete this.socket;
      }
      return this.getRelay((address) => {
        return this.connect(address);
      });
    }
  }

  sendCheck() {
    var err;
    try {
      return this.socket.send(JSON.stringify({
        name: "mp_server_status",
        server_id: `${this.project.owner.nick}/${this.project.slug}`
      }));
    } catch (error1) {
      err = error1;
      return console.error(err);
    }
  }

  getRelay(callback) {
    if (this.relay != null) {
      return callback(this.relay);
    }
    return this.app.client.sendRequest({
      name: "get_relay_server"
    }, (msg) => {
      var address;
      if (msg.name === "error") {
        return this.server_bar.setStatus("error", msg.error);
      } else {
        address = msg.address;
        if (address === "self") {
          address = location.origin.replace("http", "ws");
        }
        return callback(this.relay = address);
      }
    });
  }

  stop() {
    return clearInterval(this.interval);
  }

  connect(address) {
    var err;
    try {
      this.socket = new WebSocket(address);
    } catch (error1) {
      err = error1;
      this.server_bar.setStatus("error", this.app.translator.get("Relay service unreachable"));
    }
    this.socket.onerror = () => {
      return this.server_bar.setStatus("error", this.app.translator.get("Relay service unreachable"));
    };
    this.socket.onmessage = (msg) => {
      console.info("received: " + msg.data);
      try {
        msg = JSON.parse(msg.data);
        if (msg.name === "mp_server_status") {
          if (msg.running) {
            return this.server_bar.setStatus("running", this.app.translator.get("Running"));
          } else {
            return this.server_bar.setStatus("stopped", this.app.translator.get("Server is not running"));
          }
        }
      } catch (error1) {
        err = error1;
        return console.error(err);
      }
    };
    return this.socket.onopen = () => {
      return this.sendCheck();
    };
  }

};

this.FloatingRunWindow = class FloatingRunWindow {
  constructor(app) {
    var bounds, code, div, height, id, left, origin, parent, top, url, width;
    this.app = app;
    origin = `${location.origin.replace(".dev", ".io")}`;
    if (this.app.project.properties && this.app.project.properties.embedder_policy) {
      console.info("replacing origin to .dev");
      origin = origin.replace(".io", ".dev");
    }
    code = this.app.project.public ? "" : `${this.app.project.code}/`;
    url = `${origin}/${this.app.project.owner.nick}/${this.app.project.slug}/${code}`;
    bounds = document.querySelector("#device").getBoundingClientRect();
    if (FloatingRunWindow.offset == null) {
      FloatingRunWindow.offset = 0;
      FloatingRunWindow.id = 1;
    }
    width = bounds.width / 2;
    height = bounds.height / 2;
    left = FloatingRunWindow.offset;
    top = FloatingRunWindow.offset;
    if (FloatingRunWindow.id < 5) {
      id = FloatingRunWindow.id - 1;
      left = (id % 2) * bounds.width / 2;
      top = Math.floor(id / 2) * bounds.height / 2;
    }
    FloatingRunWindow.offset = (FloatingRunWindow.offset + 40) % 200;
    div = document.createElement("div");
    div.style = `top: ${top}px; left: ${left}px; width: ${width}px; height: ${height}px; display: block; z-index: 11;`;
    div.classList.add("floating-window");
    div.classList.add("fw-run");
    div.style.position = "absolute";
    div.id = id = "fw-run-" + FloatingRunWindow.id++;
    div.innerHTML = `<div class="content" style="padding: 1px ; top: 0px ; bottom: 0px ; left: 0 ; right: 0 ;">\n  <iframe allow="autoplay ${origin}; gamepad ${origin}; midi ${origin}" src="${url}?debug" style="width: 100% ; height: 100% ; border: none ;" class=""></iframe>\n</div>\n<div class="titlebar" style="background: rgba(128,128,128,.25)">\n  <div class="title">Client ${FloatingRunWindow.id - 1}</div>\n  <i class="minify fas fa-times-circle" style="background:none;"></i>\n</div>\n<div class="navigation" style="background: none ; pointer-events: none ;"><i class="resize fa fa-grip-horizontal" style="pointer-events: auto ; color: rgba(255,255,255,.5) ; background: rgba(0,0,0,.25) ; border-radius: 40px ; right: -5px ; bottom: -5px ;"></i></div>`;
    parent = document.querySelector("#runtime .devicecontainer");
    parent.appendChild(div);
    div.querySelector(".titlebar").addEventListener("mouseup", () => {
      console.info("focusing window");
      return div.querySelector("iframe").contentWindow.focus();
    });
    new FloatingWindow(this.app, id, {
      floatingWindowClosed: () => {
        return parent.removeChild(div);
      }
    });
  }

};

this.ProjectAccess = (function() {
  function ProjectAccess(app, directory, listener) {
    this.app = app;
    this.directory = directory != null ? directory : null;
    this.listener = listener;
  }

  ProjectAccess.prototype.fixPath = function(path) {
    var d, i, j, k, len, n, p, ref;
    if (!this.directory) {
      return path;
    } else {
      p = path.split("/");
      d = this.directory.split("/");
      for (i = j = 0, len = d.length; j < len; i = ++j) {
        n = d[i];
        p.splice(i + 1, 0, n);
      }
      for (i = k = 0, ref = p.length - 1; k <= ref; i = k += 1) {
        p[i] = RegexLib.fixFilename(p[i]);
      }
      return p.join("/");
    }
  };

  ProjectAccess.prototype.setFolder = function(directory) {
    this.directory = directory;
  };

  ProjectAccess.prototype.messageReceived = function(msg) {
    switch (msg.name) {
      case "write_project_file":
        return this.writeProjectFile(msg);
      case "list_project_files":
        return this.listProjectFiles(msg);
      case "read_project_file":
        return this.readProjectFile(msg);
      case "delete_project_file":
        return this.deleteProjectFile(msg);
    }
  };

  ProjectAccess.prototype.fileEntry = function(folder, asset) {
    var path;
    path = folder + "/" + (asset.name.replace(/-/g, "/"));
    if (this.directory) {
      path = path.replace("/" + this.directory, "");
    }
    return {
      name: asset.shortname,
      path: path,
      ext: asset.ext,
      size: asset.size
    };
  };

  ProjectAccess.prototype.listProjectFiles = function(msg) {
    var filter, kind, list, path;
    path = this.fixPath(msg.path);
    path = path.split("/");
    kind = path[0];
    path.splice(0, 1);
    path = path.join("-");
    filter = (function(_this) {
      return function(source) {
        var j, len, list, s;
        list = [];
        for (j = 0, len = source.length; j < len; j++) {
          s = source[j];
          if (s.name.startsWith(path)) {
            list.push(_this.fileEntry(kind, s));
          }
        }
        return list;
      };
    })(this);
    switch (kind) {
      case "source":
        list = filter(this.app.project.source_list);
        break;
      case "sprites":
        list = filter(this.app.project.sprite_list);
        break;
      case "maps":
        list = filter(this.app.project.map_list);
        break;
      case "sounds":
        list = filter(this.app.project.sound_list);
        break;
      case "music":
        list = filter(this.app.project.music_list);
        break;
      case "assets":
        list = filter(this.app.project.asset_list);
        break;
      default:
        this.listener.postMessage({
          name: "list_project_files",
          request_id: msg.request_id,
          error: "Folder does not exist: " + kind
        });
        return;
    }
    return this.listener.postMessage({
      name: "list_project_files",
      list: list,
      request_id: msg.request_id
    });
  };

  ProjectAccess.prototype.readProjectFile = function(msg) {
    var asset, content, data, kind, map, music, path, ref, ref1, sound, source, sprite;
    path = this.fixPath(msg.path);
    path = path.split("/");
    kind = path[0];
    switch (kind) {
      case "source":
        path.splice(0, 1);
        path = path.join("-");
        source = this.app.project.getSource(path);
        if (source != null) {
          content = source.content;
        }
        break;
      case "sprites":
        path.splice(0, 1);
        path = path.join("-");
        sprite = this.app.project.getSprite(path);
        if (sprite != null) {
          data = sprite.saveData();
          content = {
            data: data,
            fps: sprite.fps,
            frames: sprite.frames.length
          };
        }
        break;
      case "sounds":
        path.splice(0, 1);
        path = path.join("-");
        sound = this.app.project.getSound(path);
        if (sound != null) {
          fetch(sound.getURL()).then((function(_this) {
            return function(result) {
              return result.blob().then(function(blob) {
                var fr;
                fr = new FileReader();
                fr.onload = function(e) {
                  return _this.listener.postMessage({
                    name: "read_project_file",
                    request_id: msg.request_id,
                    content: fr.result
                  });
                };
                return fr.readAsDataURL(blob);
              });
            };
          })(this));
        }
        return;
      case "maps":
        path.splice(0, 1);
        path = path.join("-");
        map = this.app.project.getMap(path);
        if (map != null) {
          content = map.save();
        }
        break;
      case "music":
        path.splice(0, 1);
        path = path.join("-");
        music = this.app.project.getMusic(path);
        if (music != null) {
          fetch(music.getURL()).then((function(_this) {
            return function(result) {
              return result.blob().then(function(blob) {
                var fr;
                fr = new FileReader();
                fr.onload = function(e) {
                  return _this.listener.postMessage({
                    name: "read_project_file",
                    request_id: msg.request_id,
                    content: fr.result
                  });
                };
                return fr.readAsDataURL(blob);
              });
            };
          })(this));
        }
        return;
      case "assets":
        path.splice(0, 1);
        path = path.join("-");
        asset = this.app.project.getAsset(path);
        if (asset != null) {
          if ((ref = asset.ext) === "txt" || ref === "csv" || ref === "obj") {
            fetch(asset.getURL()).then((function(_this) {
              return function(result) {
                return result.text().then(function(text) {
                  return _this.listener.postMessage({
                    name: "read_project_file",
                    request_id: msg.request_id,
                    content: {
                      data: text,
                      type: "text"
                    }
                  });
                });
              };
            })(this));
          } else if (asset.ext === "json") {
            fetch(asset.getURL()).then((function(_this) {
              return function(result) {
                return result.json().then(function(json) {
                  return _this.listener.postMessage({
                    name: "read_project_file",
                    request_id: msg.request_id,
                    content: {
                      data: json,
                      type: "json"
                    }
                  });
                });
              };
            })(this));
          } else if ((ref1 = asset.ext) === "png" || ref1 === "jpg") {
            fetch(asset.getURL()).then((function(_this) {
              return function(result) {
                return result.blob().then(function(blob) {
                  var fr;
                  fr = new FileReader();
                  fr.onload = function(r) {
                    return _this.listener.postMessage({
                      name: "read_project_file",
                      request_id: msg.request_id,
                      content: {
                        data: fr.result,
                        type: "image"
                      }
                    });
                  };
                  return fr.readAsDataURL(blob);
                });
              };
            })(this));
          }
        }
        return;
      default:
        this.listener.postMessage({
          name: "read_project_file",
          request_id: msg.request_id,
          error: "Folder does not exist: " + kind
        });
    }
    if (content != null) {
      return this.listener.postMessage({
        name: "read_project_file",
        request_id: msg.request_id,
        content: content
      });
    } else {
      return this.listener.postMessage({
        name: "read_project_file",
        request_id: msg.request_id,
        error: "File Not Found"
      });
    }
  };

  ProjectAccess.prototype.projectFileExists = function(path) {
    var kind;
    path = path.split("/");
    kind = path[0];
    path.splice(0, 1);
    path = path.join("-");
    switch (kind) {
      case "source":
        return this.app.project.source_table[path];
      case "sprites":
        return this.app.project.sprite_table[path];
      case "maps":
        return this.app.project.map_table[path];
      case "sounds":
        return this.app.project.sound_table[path];
      case "music":
        return this.app.project.music_table[path];
      case "assets":
        return this.app.project.asset_table[path];
    }
    return false;
  };

  ProjectAccess.prototype.writeProjectFile = function(msg) {
    var base, count, kind, name, path;
    path = this.fixPath(msg.path);
    path = path.split("/");
    kind = path[0];
    if (!(msg.options && msg.options.replace)) {
      base = path.join("/");
      name = base;
      count = 2;
      while (this.projectFileExists(name)) {
        name = base + count++;
      }
      path = name.split("/");
    }
    switch (kind) {
      case "source":
        path.splice(0, 1);
        path = "ms/" + path.join("/");
        this.app.project.writeFile(path, msg.content);
        this.app.appui.bumpElement("#menuitem-code");
        break;
      case "sprites":
        path.splice(0, 1);
        path = "sprites/" + path.join("/");
        this.app.project.writeFile(path, msg.content, {
          frames: msg.frames,
          fps: msg.fps
        });
        this.app.appui.bumpElement("#menuitem-sprites");
        break;
      case "maps":
        path.splice(0, 1);
        path = "maps/" + path.join("/");
        this.app.project.writeFile(path, msg.content);
        this.app.appui.bumpElement("#menuitem-maps");
        break;
      case "sounds":
        path.splice(0, 1);
        path = "sounds/" + path.join("/");
        this.app.project.writeFile(path, msg.content);
        this.app.appui.bumpElement("#menuitem-sounds");
        break;
      case "music":
        path.splice(0, 1);
        path = "music/" + path.join("/");
        this.app.project.writeFile(path, msg.content);
        this.app.appui.bumpElement("#menuitem-music");
        break;
      case "assets":
        path.splice(0, 1);
        path = "assets/" + path.join("/");
        this.app.project.writeFile(path, msg.content, {
          ext: msg.ext
        });
        this.app.appui.bumpElement("#menuitem-assets");
        break;
      default:
        this.listener.postMessage({
          name: "write_project_file",
          request_id: msg.request_id,
          error: "Folder does not exist: " + kind
        });
        return;
    }
    return this.listener.postMessage({
      name: "write_project_file",
      request_id: msg.request_id,
      content: "success"
    });
  };

  ProjectAccess.prototype.deleteProjectFile = function(msg) {
    var asset, deleteFile, error, kind, map, music, path, sound, source, sprite;
    path = this.fixPath(msg.path);
    path = path.split("/");
    kind = path[0];
    path.splice(0, 1);
    path = path.join("-");
    deleteFile = (function(_this) {
      return function(path, thumbnail, callback) {
        return _this.app.client.sendRequest({
          name: "delete_project_file",
          project: _this.app.project.id,
          file: path,
          thumbnail: thumbnail
        }, function(response) {
          callback();
          return _this.listener.postMessage({
            name: "delete_project_file",
            request_id: msg.request_id,
            content: "success"
          });
        });
      };
    })(this);
    error = (function(_this) {
      return function(text) {
        return _this.listener.postMessage({
          name: "delete_project_file",
          request_id: msg.request_id,
          error: text
        });
      };
    })(this);
    switch (kind) {
      case "source":
        source = this.app.project.getSource(path);
        if (source != null) {
          return deleteFile(source.file, false, (function(_this) {
            return function() {
              return _this.app.project.updateSourceList();
            };
          })(this));
        } else {
          return error("File Not Found");
        }
        break;
      case "sprites":
        sprite = this.app.project.getSprite(path);
        if ((sprite != null) && path !== "icon") {
          return deleteFile(sprite.file, false, (function(_this) {
            return function() {
              return _this.app.project.updateSpriteList();
            };
          })(this));
        } else {
          return error("File Not Found");
        }
        break;
      case "maps":
        map = this.app.project.getMap(path);
        if (map != null) {
          return deleteFile(map.file, false, (function(_this) {
            return function() {
              return _this.app.project.updateMapList();
            };
          })(this));
        } else {
          return error("File Not Found");
        }
        break;
      case "sounds":
        sound = this.app.project.getSound(path);
        if (sound != null) {
          return deleteFile(sound.file, true, (function(_this) {
            return function() {
              return _this.app.project.updateSoundList();
            };
          })(this));
        } else {
          return error("File Not Found");
        }
        break;
      case "music":
        music = this.app.project.getMusic(path);
        if (music != null) {
          return deleteFile(music.file, true, (function(_this) {
            return function() {
              return _this.app.project.updateMusicList();
            };
          })(this));
        } else {
          return error("File Not Found");
        }
        break;
      case "assets":
        asset = this.app.project.getAsset(path);
        if (asset != null) {
          return deleteFile(asset.file, true, (function(_this) {
            return function() {
              return _this.app.project.updateAssetList();
            };
          })(this));
        } else {
          return error("File Not Found");
        }
    }
  };

  return ProjectAccess;

})();

this.RulerCanvas = (function() {
  function RulerCanvas(app) {
    this.app = app;
    this.canvas = document.getElementById("ruler-canvas");
    this.update();
  }

  RulerCanvas.prototype.resize = function(width, height, top) {
    this.canvas.style["margin-top"] = top + "px";
    this.canvas.style.width = width + "px";
    this.canvas.style.height = height + "px";
    this.canvas.width = width;
    return this.canvas.height = height;
  };

  RulerCanvas.prototype.hide = function() {
    return this.canvas.style.display = "none";
  };

  RulerCanvas.prototype.show = function() {
    return this.canvas.style.display = "inline-block";
  };

  RulerCanvas.prototype.showX = function(x, y, w, h) {
    this.show();
    return this.current = (function(_this) {
      return function() {
        var context, h1, h2, ratio, w1, w2;
        context = _this.canvas.getContext("2d");
        context.save();
        context.translate(_this.canvas.width / 2, _this.canvas.height / 2);
        ratio = Math.min(_this.canvas.width, _this.canvas.height) / 200;
        context.scale(ratio, ratio);
        w1 = _this.canvas.width * ratio;
        h1 = _this.canvas.height * ratio;
        w2 = Math.round(w1 / 2);
        h2 = Math.round(h1 / 2);
        context.clearRect(-w2, -h2, w1, h1);
        _this.drawXAxis(context);
        _this.drawDottedLine(context, x, 0, x, -y);
        _this.drawLine(context, x - 3, -y - 3, x + 3, -y + 3);
        _this.drawLine(context, x + 3, -y - 3, x - 3, -y + 3);
        context.strokeStyle = "rgba(0,0,0,.3)";
        context.strokeRect(x - w / 2 + .5, -y - h / 2 + .5, w, h);
        context.strokeStyle = "rgba(255,255,255,.3)";
        context.strokeRect(x - w / 2, -y - h / 2, w, h);
        return context.restore();
      };
    })(this);
  };

  RulerCanvas.prototype.showY = function(x, y, w, h) {
    this.show();
    return this.current = (function(_this) {
      return function() {
        var context, h1, h2, ratio, w1, w2;
        context = _this.canvas.getContext("2d");
        context.save();
        context.translate(_this.canvas.width / 2, _this.canvas.height / 2);
        ratio = Math.min(_this.canvas.width, _this.canvas.height) / 200;
        context.scale(ratio, ratio);
        w1 = _this.canvas.width * ratio;
        h1 = _this.canvas.height * ratio;
        w2 = Math.round(w1 / 2);
        h2 = Math.round(h1 / 2);
        context.clearRect(-w2, -h2, w1, h1);
        _this.drawYAxis(context);
        _this.drawDottedLine(context, 0, -y, x, -y);
        _this.drawLine(context, x - 3, -y - 3, x + 3, -y + 3);
        _this.drawLine(context, x + 3, -y - 3, x - 3, -y + 3);
        context.strokeStyle = "rgba(0,0,0,.3)";
        context.strokeRect(x - w / 2 + .5, -y - h / 2 + .5, w, h);
        context.strokeStyle = "rgba(255,255,255,.3)";
        context.strokeRect(x - w / 2, -y - h / 2, w, h);
        return context.restore();
      };
    })(this);
  };

  RulerCanvas.prototype.showW = function(x, y, w, h) {
    this.show();
    return this.current = (function(_this) {
      return function() {
        var context, h1, h2, ratio, w1, w2;
        context = _this.canvas.getContext("2d");
        context.save();
        context.translate(_this.canvas.width / 2, _this.canvas.height / 2);
        ratio = Math.min(_this.canvas.width, _this.canvas.height) / 200;
        context.scale(ratio, ratio);
        w1 = _this.canvas.width * ratio;
        h1 = _this.canvas.height * ratio;
        w2 = Math.round(w1 / 2);
        h2 = Math.round(h1 / 2);
        context.clearRect(-w2, -h2, w1, h1);
        _this.drawLine(context, x - 3, -y - 3, x + 3, -y + 3);
        _this.drawLine(context, x + 3, -y - 3, x - 3, -y + 3);
        context.strokeStyle = "rgba(0,0,0,.3)";
        context.strokeRect(x - w / 2 + .5, -y - h / 2 + .5, w, h);
        context.strokeStyle = "rgba(255,255,255,.3)";
        context.strokeRect(x - w / 2, -y - h / 2, w, h);
        if (y > 0) {
          _this.drawHorizontalArrow(context, x, -y + h / 2 + 10, w);
        } else {
          _this.drawHorizontalArrow(context, x, -y - h / 2 - 10, w);
        }
        return context.restore();
      };
    })(this);
  };

  RulerCanvas.prototype.showH = function(x, y, w, h) {
    this.show();
    return this.current = (function(_this) {
      return function() {
        var context, h1, h2, ratio, w1, w2;
        context = _this.canvas.getContext("2d");
        context.save();
        context.translate(_this.canvas.width / 2, _this.canvas.height / 2);
        ratio = Math.min(_this.canvas.width, _this.canvas.height) / 200;
        context.scale(ratio, ratio);
        w1 = _this.canvas.width * ratio;
        h1 = _this.canvas.height * ratio;
        w2 = Math.round(w1 / 2);
        h2 = Math.round(h1 / 2);
        context.clearRect(-w2, -h2, w1, h1);
        _this.drawLine(context, x - 3, -y - 3, x + 3, -y + 3);
        _this.drawLine(context, x + 3, -y - 3, x - 3, -y + 3);
        context.strokeStyle = "rgba(0,0,0,.3)";
        context.strokeRect(x - w / 2 + .5, -y - h / 2 + .5, w, h);
        context.strokeStyle = "rgba(255,255,255,.3)";
        context.strokeRect(x - w / 2, -y - h / 2, w, h);
        if (x > 0) {
          _this.drawVerticalArrow(context, x - w / 2 - 10, -y, h);
        } else {
          _this.drawVerticalArrow(context, x + w / 2 + 10, -y, h);
        }
        return context.restore();
      };
    })(this);
  };

  RulerCanvas.prototype.showBox = function(x, y, w, h) {
    this.show();
    return this.current = (function(_this) {
      return function() {
        var context, h1, h2, ratio, w1, w2;
        context = _this.canvas.getContext("2d");
        context.save();
        context.translate(_this.canvas.width / 2, _this.canvas.height / 2);
        ratio = Math.min(_this.canvas.width, _this.canvas.height) / 200;
        context.scale(ratio, ratio);
        w1 = _this.canvas.width * ratio;
        h1 = _this.canvas.height * ratio;
        w2 = Math.round(w1 / 2);
        h2 = Math.round(h1 / 2);
        context.clearRect(-w2, -h2, w1, h1);
        _this.drawLine(context, x - 3, -y - 3, x + 3, -y + 3);
        _this.drawLine(context, x + 3, -y - 3, x - 3, -y + 3);
        context.strokeStyle = "rgba(0,0,0,.3)";
        context.strokeRect(x - w / 2 + .5, -y - h / 2 + .5, w, h);
        context.strokeStyle = "rgba(255,255,255,.3)";
        context.strokeRect(x - w / 2, -y - h / 2, w, h);
        return context.restore();
      };
    })(this);
  };

  RulerCanvas.prototype.drawHorizontalArrow = function(context, x, y, w) {
    this.drawLine(context, x - w / 2 + 2, y, x + w / 2 - 2, y);
    this.drawLine(context, x - w / 2, y - 5, x - w / 2, y + 5);
    this.drawLine(context, x + w / 2, y - 5, x + w / 2, y + 5);
    this.drawLine(context, x - w / 2 + 1, y, x - w / 2 + 6, y + 5);
    this.drawLine(context, x - w / 2 + 1, y, x - w / 2 + 6, y - 5);
    this.drawLine(context, x + w / 2 - 1, y, x + w / 2 - 6, y + 5);
    return this.drawLine(context, x + w / 2 - 1, y, x + w / 2 - 6, y - 5);
  };

  RulerCanvas.prototype.drawVerticalArrow = function(context, x, y, h) {
    this.drawLine(context, x, y - h / 2 + 2, x, y + h / 2 - 2);
    this.drawLine(context, x - 5, y - h / 2, x + 5, y - h / 2);
    this.drawLine(context, x - 5, y + h / 2, x + 5, y + h / 2);
    this.drawLine(context, x, y - h / 2 + 1, x + 5, y - h / 2 + 6, this.drawLine(context, x, y - h / 2 + 1, x - 5, y - h / 2 + 6));
    this.drawLine(context, x, y + h / 2 - 1, x + 5, y + h / 2 - 6);
    return this.drawLine(context, x, y + h / 2 - 1, x - 5, y + h / 2 - 6);
  };

  RulerCanvas.prototype.update = function() {
    requestAnimationFrame((function(_this) {
      return function() {
        return _this.update();
      };
    })(this));
    if (!(this.canvas.width > 0 && this.canvas.height > 0)) {
      return;
    }
    if (this.current != null) {
      this.current();
      return this.current = null;
    }
  };

  RulerCanvas.prototype.drawLine = function(context, x1, y1, x2, y2) {
    context.strokeStyle = "rgba(0,0,0,.8)";
    context.beginPath();
    context.moveTo(x1 + .5, y1 + .5);
    context.lineTo(x2 + .5, y2 + .5);
    context.stroke();
    context.strokeStyle = "rgba(255,255,255,.8)";
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    return context.stroke();
  };

  RulerCanvas.prototype.drawDottedLine = function(context, x1, y1, x2, y2) {
    context.setLineDash([2, 2]);
    this.drawLine(context, x1, y1, x2, y2);
    return context.setLineDash([]);
  };

  RulerCanvas.prototype.drawText = function(context, text, x, y) {
    context.font = "6pt Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "rgba(0,0,0,.8)";
    context.fillText(text, x + .5, y + .5);
    context.fillStyle = "rgba(255,255,255,.8)";
    return context.fillText(text, x, y);
  };

  RulerCanvas.prototype.drawXAxis = function(context) {
    var h, h2, i, j, ratio, ref, w, w2;
    this.drawLine(context, 0, -5, 0, 5);
    ratio = 200 / Math.min(this.canvas.width, this.canvas.height);
    w = this.canvas.width * ratio;
    h = this.canvas.height * ratio;
    w2 = Math.round(w / 2);
    h2 = Math.round(h / 2);
    for (i = j = 50, ref = w2 - 50; j <= ref; i = j += 50) {
      this.drawLine(context, i, -2, i, 2);
      this.drawLine(context, -i, -2, -i, 2);
      this.drawText(context, "+" + i, i, 12);
      this.drawText(context, "-" + i, -i, 12);
    }
    this.drawText(context, "0", 0, 12);
    this.drawLine(context, -w2 + 2, 0, w2 - 2, 0);
    this.drawText(context, "+" + w2, w2 - 12, 12);
    this.drawText(context, "-" + w2, -w2 + 12, 12);
    this.drawLine(context, -w2 + 1, 0, -w2 + 6, 5);
    this.drawLine(context, -w2 + 1, 0, -w2 + 6, -5);
    this.drawLine(context, -w2 + 1, -5, -w2 + 1, 5);
    this.drawLine(context, w2 - 1, 0, w2 - 6, 5);
    this.drawLine(context, w2 - 1, 0, w2 - 6, -5);
    return this.drawLine(context, w2 - 1, -5, w2 - 1, 5);
  };

  RulerCanvas.prototype.drawYAxis = function(context) {
    var h, h2, i, j, ratio, ref, w, w2;
    this.drawLine(context, -5, 0, 5, 0);
    ratio = 200 / Math.min(this.canvas.width, this.canvas.height);
    w = this.canvas.width * ratio;
    h = this.canvas.height * ratio;
    w2 = Math.round(w / 2);
    h2 = Math.round(h / 2);
    for (i = j = 50, ref = h2 - 50; j <= ref; i = j += 50) {
      this.drawLine(context, -2, i, 2, i);
      this.drawLine(context, -2, -i, 2, -i);
      this.drawText(context, "+" + i, -12, -i);
      this.drawText(context, "-" + i, -12, i);
    }
    this.drawText(context, "0", -12, 0);
    this.drawLine(context, 0, -h2 + 2, 0, h2 - 2);
    this.drawText(context, "+" + h2, -12, -h2 + 12);
    this.drawText(context, "-" + h2, -12, h2 - 12);
    this.drawLine(context, 0, -h2 + 1, 5, -h2 + 6);
    this.drawLine(context, 0, -h2 + 1, -5, -h2 + 6);
    this.drawLine(context, -5, -h2 + 1, 5, -h2 + 1);
    this.drawLine(context, 0, h2 - 1, 5, h2 - 6);
    this.drawLine(context, 0, h2 - 1, -5, h2 - 6);
    return this.drawLine(context, -5, h2 - 1, 5, h2 - 1);
  };

  RulerCanvas.prototype.drawBounds = function(context) {
    var h, h2, i, j, k, l, m, ratio, ref, ref1, ref2, ref3, w, w2;
    context.lineWidth = 1;
    this.drawLine(context, -5, 0, 5, 0);
    this.drawLine(context, 0, -5, 0, 5);
    ratio = 200 / Math.min(this.canvas.width, this.canvas.height);
    w = this.canvas.width * ratio;
    h = this.canvas.height * ratio;
    w2 = Math.round(w / 2);
    h2 = Math.round(h / 2);
    this.drawLine(context, w / 2 - 1, -5, w / 2 - 1, 5);
    for (i = j = 50, ref = w2 - 1; j <= ref; i = j += 50) {
      this.drawLine(context, i, -2, i, 2);
    }
    this.drawLine(context, -w / 2 + 1, -5, -w / 2 + 1, 5);
    for (i = k = 50, ref1 = w2 - 1; k <= ref1; i = k += 50) {
      this.drawLine(context, -i, -2, -i, 2);
    }
    this.drawLine(context, -5, -h / 2 + 1, 5, -h / 2 + 1);
    for (i = l = 50, ref2 = h2 - 1; l <= ref2; i = l += 50) {
      this.drawLine(context, -2, -i, 2, -i);
    }
    this.drawLine(context, -5, h / 2 - 1, 5, h / 2 - 1);
    for (i = m = 50, ref3 = h2 - 1; m <= ref3; i = m += 50) {
      this.drawLine(context, -2, i, 2, i);
    }
    this.drawText(context, "0,0", 0, 12);
    this.drawText(context, "+" + w2, w2 - 12, 12);
    this.drawText(context, "-" + w2, -w2 + 12, 12);
    this.drawText(context, "+" + h2, 20, -h2 + 5);
    return this.drawText(context, "-" + h2, 20, h2 - 5);
  };

  RulerCanvas.prototype.showPolygon = function(args, index) {
    this.show();
    return this.current = (function(_this) {
      return function() {
        var context, h1, h2, i, j, num, px, py, ratio, ref, w1, w2, x, y;
        context = _this.canvas.getContext("2d");
        context.save();
        context.translate(_this.canvas.width / 2, _this.canvas.height / 2);
        ratio = Math.min(_this.canvas.width, _this.canvas.height) / 200;
        context.scale(ratio, ratio);
        w1 = _this.canvas.width * ratio;
        h1 = _this.canvas.height * ratio;
        w2 = Math.round(w1 / 2);
        h2 = Math.round(h1 / 2);
        context.clearRect(-w2, -h2, w1, h1);
        if (index % 2 === 0) {
          _this.drawXAxis(context);
        } else {
          _this.drawYAxis(context);
        }
        num = Math.floor((args.length + 1) / 2);
        for (i = j = 0, ref = num - 1; j <= ref; i = j += 1) {
          x = args[i * 2];
          y = args[i * 2 + 1];
          if ((y == null) || typeof y !== "number") {
            y = 0;
          }
          if (num > 0) {
            _this.drawLine(context, px, -py, x, -y);
          }
          px = x;
          py = y;
          if (i * 2 === index) {
            _this.drawDottedLine(context, x, 0, x, -y);
          } else if (i * 2 + 1 === index) {
            _this.drawDottedLine(context, 0, -y, x, -y);
          }
          _this.drawLine(context, x - 3, -y - 3, x + 3, -y + 3);
          _this.drawLine(context, x + 3, -y - 3, x - 3, -y + 3);
        }
        return context.restore();
      };
    })(this);
  };

  return RulerCanvas;

})();

this.ValueTool = (function() {
  function ValueTool(editor, x, y, value, callback) {
    var max, min;
    this.editor = editor;
    this.x = x;
    this.y = y;
    this.value = value;
    this.callback = callback;
    this.tool = document.createElement("div");
    this.tool.classList.add("value-tool");
    this.tool.addEventListener('contextmenu', function(event) {
      return event.preventDefault();
    });
    max = Math.max(100, Math.abs(this.value * 2));
    min = -max;
    this.slider = document.createElement("input");
    this.slider.type = "range";
    this.slider.min = min;
    this.slider.max = max;
    this.slider.value = this.value;
    this.slider.addEventListener("input", (function(_this) {
      return function(event) {
        return _this.callback(_this.slider.value);
      };
    })(this));
    this.tool.appendChild(this.slider);
    this.y = Math.max(0, this.y - 60) + document.querySelector("#editor-view .ace_content").getBoundingClientRect().y;
    this.x = Math.max(0, this.x - 150) + document.querySelector("#editor-view .ace_content").getBoundingClientRect().x;
    this.tool.style = "z-index: 20;top:" + this.y + "px;left:" + this.x + "px;";
    document.getElementById("editor-view").appendChild(this.tool);
    this.tool.addEventListener("mousedown", function(event) {
      return event.stopPropagation();
    });
  }

  ValueTool.prototype.dispose = function() {
    return document.getElementById("editor-view").removeChild(this.tool);
  };

  return ValueTool;

})();

this.ColorValueTool = (function() {
  function ColorValueTool(editor, x, y, value, callback) {
    var canvas, context, data, div, err;
    this.editor = editor;
    this.x = x;
    this.y = y;
    this.value = value;
    this.callback = callback;
    this.tool = document.createElement("div");
    this.tool.classList.add("value-tool");
    this.tool.addEventListener('contextmenu', function(event) {
      return event.preventDefault();
    });
    try {
      canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      context = canvas.getContext("2d");
      context.fillStyle = this.value;
      context.fillRect(0, 0, 1, 1);
      data = context.getImageData(0, 0, 1, 1);
    } catch (error) {
      err = error;
    }
    div = document.createElement("div");
    div.classList.add("colortext");
    this.input = document.createElement("input");
    this.input.spellcheck = false;
    this.input.addEventListener("input", (function(_this) {
      return function(event) {
        return _this.colortextChanged();
      };
    })(this));
    this.copy = document.createElement("i");
    this.copy.classList.add("fa");
    this.copy.classList.add("fa-copy");
    this.copy.addEventListener("click", (function(_this) {
      return function(event) {
        _this.copy.classList.remove("fa-copy");
        _this.copy.classList.add("fa-check");
        setTimeout((function() {
          _this.copy.classList.remove("fa-check");
          return _this.copy.classList.add("fa-copy");
        }), 3000);
        return navigator.clipboard.writeText("\"" + _this.input.value + "\"");
      };
    })(this));
    this.picker = new ColorPicker(this);
    this.tool.appendChild(this.picker.canvas);
    this.tool.appendChild(div);
    div.appendChild(this.copy);
    div.appendChild(this.input);
    if (data != null) {
      this.picker.colorPicked(data.data);
    }
    this.y = Math.max(0, this.y - 200) + document.querySelector("#editor-view .ace_content").getBoundingClientRect().y;
    this.x = Math.max(0, this.x + 75) + document.querySelector("#editor-view .ace_content").getBoundingClientRect().x;
    this.tool.style = "z-index: 20;top:" + this.y + "px;left:" + this.x + "px;";
    document.getElementById("editor-view").appendChild(this.tool);
    this.started = true;
    this.tool.addEventListener("mousedown", function(event) {
      return event.stopPropagation();
    });
  }

  ColorValueTool.prototype.colortextChanged = function() {
    this.picker.color = this.input.value;
    return this.picker.colorPicked(this.input.value);
  };

  ColorValueTool.prototype.setColor = function(color) {
    this.color = color;
    if (this.started) {
      this.callback(this.color);
    }
    return this.input.value = this.color;
  };

  ColorValueTool.prototype.dispose = function() {
    return document.getElementById("editor-view").removeChild(this.tool);
  };

  return ColorValueTool;

})();

this.LibManager = (function() {
  function LibManager(app) {
    this.app = app;
    this.known_libs = {};
  }

  LibManager.prototype.projectOpened = function() {
    this.active_libs = {};
    return this.updateLibSelection();
  };

  LibManager.prototype.createLibBox = function(project) {
    var desc, div, e, i, id, len, list, nick, path, user;
    console.info(project);
    nick = typeof project.owner === "string" ? project.owner : project.owner.nick;
    id = project.id;
    path = "/" + nick + "/" + project.slug;
    if (project.code != null) {
      path += "/" + project.code;
    }
    this.known_libs[id] = {
      nick: nick,
      slug: project.slug,
      title: project.title,
      code: project.code,
      url: "" + location.origin + path + "/",
      language: project.language
    };
    div = document.createElement("div");
    div.classList.add("lib-box");
    div.dataset.id = id;
    desc = project.description;
    if (desc.length > 300) {
      desc = desc.substring(0, 300) + " (...)";
    }
    div.innerHTML = "<img class=\"pixelated icon\" src=\"" + location.origin + path + "/sprites/icon.png\"/>\n<div class=\"description md dark\">\n  <div class=\"plugin-author\"></div>\n  <h4>" + project.title + "</h4>\n  <p>" + (DOMPurify.sanitize(marked(desc))) + "</p>\n  <div class=\"docbutton\"><i class=\"fa fa-book-open\"></i> " + (this.app.translator.get("Documentation")) + "</div>\n" + (project.code == null ? "<a class=\"docbutton\" href=\"" + location.origin + "/i/" + nick + "/" + project.slug + "/\" target=\"_blank\"><i class=\"fa fa-eye\"></i> " + (this.app.translator.get("Library Details")) + "</a>" : "") + "\n  <i class=\"fa fa-check check\"></i>\n</div>";
    list = div.getElementsByTagName("a");
    for (i = 0, len = list.length; i < len; i++) {
      e = list[i];
      e.target = "_blank";
      e.addEventListener("click", (function(_this) {
        return function(event) {
          return event.stopPropagation();
        };
      })(this));
    }
    if (project.owner_info) {
      user = this.app.appui.createUserTag(nick, project.owner_info.tier, project.owner_info.profile_image, 20);
    } else if (project.owner.nick === this.app.user.nick) {
      user = this.app.appui.createUserTag(this.app.user.nick, this.app.user.flags.tier || "", this.app.user.flags.profile_image, 20);
    } else {
      user = this.app.appui.createUserTag(project.owner.nick, "", false, 20);
    }
    div.querySelector(".plugin-author").appendChild(user);
    div.id = "lib-box-" + id;
    div.addEventListener("click", (function(_this) {
      return function() {
        if (div.querySelector("input") !== document.activeElement) {
          return _this.toggleLib(id);
        }
      };
    })(this));
    div.querySelector(".docbutton").addEventListener("click", (function(_this) {
      return function(event) {
        event.stopPropagation();
        return _this.openDoc(id);
      };
    })(this));
    return div;
  };

  LibManager.prototype.toggleLib = function(id) {
    if (this.isLibActive(id)) {
      return this.setLibActive(id, false);
    } else {
      return this.setLibActive(id, true);
    }
  };

  LibManager.prototype.resetLibs = function() {
    return this.libs_fetched = false;
  };

  LibManager.prototype.fetchAvailableLibs = function(callback) {
    var box, i, len, p, ref, your_libs, your_list;
    if (this.libs_fetched) {
      return callback();
    }
    this.libs_fetched = true;
    your_libs = document.querySelector("#your-libs");
    your_list = document.querySelector("#your-libs .lib-list");
    your_list.innerHTML = "";
    ref = this.app.projects;
    for (i = 0, len = ref.length; i < len; i++) {
      p = ref[i];
      if (p.type === "library") {
        box = this.createLibBox(p);
        your_list.appendChild(box);
      }
    }
    if (your_list.childNodes.length === 0) {
      your_libs.style.display = "none";
    } else {
      your_libs.style.display = "block";
    }
    return this.app.client.sendRequest({
      name: "get_public_libraries"
    }, (function(_this) {
      return function(msg) {
        var j, len1, public_libs, public_list, ref1;
        console.info(msg.list);
        public_libs = document.querySelector("#public-libs");
        public_list = document.querySelector("#public-libs .lib-list");
        ref1 = msg.list;
        for (j = 0, len1 = ref1.length; j < len1; j++) {
          p = ref1[j];
          if (_this.known_libs[p.id] == null) {
            box = _this.createLibBox(p);
            public_list.appendChild(box);
          }
        }
        if (public_list.childNodes.length === 0) {
          public_libs.style.display = "none";
        } else {
          public_libs.style.display = "block";
        }
        return callback();
      };
    })(this));
  };

  LibManager.prototype.updateLibSelection = function() {
    return this.fetchAvailableLibs((function(_this) {
      return function() {
        var e, i, key, len, lib, libs, list, ref, value;
        list = document.querySelectorAll(".lib-box");
        libs = _this.app.project.libraries || {};
        for (i = 0, len = list.length; i < len; i++) {
          e = list[i];
          if (libs[e.dataset.id]) {
            e.classList.add("selected");
          } else {
            e.classList.remove("selected");
          }
          lib = _this.known_libs[e.dataset.id];
          if ((lib != null) && lib.language.split("_")[0] === _this.app.project.language.split("_")[0]) {
            e.style.display = "block";
          } else {
            e.style.display = "none";
          }
        }
        for (key in libs) {
          value = libs[key];
          if (!_this.active_libs[key]) {
            _this.active_libs[key] = value;
            _this.createLibUI(key);
          }
        }
        ref = _this.active_libs;
        for (key in ref) {
          value = ref[key];
          if (!libs[key]) {
            delete _this.active_libs[key];
            _this.app.documentation.removeLib(key);
          }
        }
      };
    })(this));
  };

  LibManager.prototype.isLibActive = function(id) {
    var libs, p;
    p = this.app.project;
    if (!p) {
      return false;
    }
    libs = p.libraries || {};
    return libs[id] != null;
  };

  LibManager.prototype.setLibActive = function(id, active) {
    var p;
    p = this.app.project;
    if (p.libraries == null) {
      p.libraries = {};
    }
    if (active) {
      p.libraries[id] = {
        active: true
      };
    } else {
      delete p.libraries[id];
    }
    this.updateLibSelection();
    if (active) {
      this.install(id);
    } else {
      this.remove(id);
    }
    return this.app.client.sendRequest({
      name: "set_project_option",
      project: this.app.project.id,
      option: "libraries",
      value: p.libraries
    }, (function(_this) {
      return function(msg) {};
    })(this));
  };

  LibManager.prototype.createLibUI = function(id) {
    var data, doc_url, path;
    data = this.known_libs[id];
    if (data == null) {
      return;
    }
    if (data.code != null) {
      path = data.nick + "/" + data.slug + "/" + data.code;
    } else {
      path = data.nick + "/" + data.slug;
    }
    doc_url = location.origin + "/" + path + "/doc/doc.md";
    return this.app.documentation.addLib(id, data.title, doc_url);
  };

  LibManager.prototype.openDoc = function(id) {
    var data, doc_url, path;
    this.createLibUI(id);
    data = this.known_libs[id];
    if (data == null) {
      return;
    }
    if (data.code != null) {
      path = data.nick + "/" + data.slug + "/" + data.code;
    } else {
      path = data.nick + "/" + data.slug;
    }
    doc_url = location.origin + "/" + path + "/doc/doc.md";
    this.app.documentation.setSection(id, ((function(_this) {
      return function() {};
    })(this)), doc_url);
    return this.app.appui.setMainSection("help", true);
  };

  LibManager.prototype.projectClosed = function() {
    this.app.documentation.removeAllLibs();
  };

  LibManager.prototype.install = function(id) {
    var lib;
    lib = this.known_libs[id];
    if (lib != null) {
      return this.app.client.sendRequest({
        name: "list_project_files",
        project: id,
        folder: "ms"
      }, (function(_this) {
        return function(msg) {
          var f, files, i, j, k, len, len1, len2, ref, ref1, results;
          console.info(msg.files);
          files = [];
          ref = msg.files;
          for (i = 0, len = ref.length; i < len; i++) {
            f = ref[i];
            if (f.file.startsWith("lib-")) {
              files.push(f);
            }
          }
          if (files.length === 0) {
            ref1 = msg.files;
            for (j = 0, len1 = ref1.length; j < len1; j++) {
              f = ref1[j];
              if (!f.file.includes("demo") && !f.file.includes("main") && !f.file.includes("test") && !f.file.includes("example")) {
                files.push(f);
              }
            }
          }
          if (files.length === 0) {
            files = msg.files;
          }
          results = [];
          for (k = 0, len2 = files.length; k < len2; k++) {
            f = files[k];
            results.push((function(f) {
              var name;
              name = f.file;
              if (name.startsWith("lib-")) {
                name = name.substring(4);
              }
              name = "lib-" + (RegexLib.fixFilename(lib.nick)) + "-" + (RegexLib.fixFilename(lib.slug)) + "-" + (name.substring(0, name.length - 3));
              return _this.app.client.sendRequest({
                name: "read_project_file",
                project: id,
                file: "ms/" + f.file
              }, function(msg) {
                console.info(msg.content);
                return _this.app.project.writeSourceFile(name, msg.content);
              });
            })(f));
          }
          return results;
        };
      })(this));
    }
  };

  LibManager.prototype.remove = function(id) {
    var file, i, j, len, len1, lib, list, ref, results, start;
    lib = this.known_libs[id];
    if (lib != null) {
      start = "lib-" + (RegexLib.fixFilename(lib.nick)) + "-" + (RegexLib.fixFilename(lib.slug));
      list = [];
      ref = this.app.project.source_list;
      for (i = 0, len = ref.length; i < len; i++) {
        file = ref[i];
        if (file.name.startsWith(start)) {
          list.push(file);
        }
      }
      results = [];
      for (j = 0, len1 = list.length; j < len1; j++) {
        file = list[j];
        results.push(this.app.client.sendRequest({
          name: "delete_project_file",
          project: this.app.project.id,
          file: "ms/" + file.name + ".ms"
        }, (function(_this) {
          return function(msg) {
            console.info(msg);
            return _this.app.project.updateSourceList();
          };
        })(this)));
      }
      return results;
    }
  };

  return LibManager;

})();

var DEFAULT_CODE;

this.Options = class Options {
  constructor(app) {
    var advanced, input, j, len, list;
    this.app = app;
    this.textInput("projectoption-name", (value) => {
      return this.optionChanged("title", value);
    });
    this.project_slug_validator = new InputValidator(document.getElementById("projectoption-slug"), document.getElementById("project-slug-button"), null, (value) => {
      return this.optionChanged("slug", value[0]);
    });
    this.project_code_validator = new InputValidator(document.getElementById("projectoption-code"), document.getElementById("project-code-button"), null, (value) => {
      return this.optionChanged("code", value[0]);
    });
    this.selectInput("projectoption-orientation", (value) => {
      return this.orientationChanged(value);
    });
    this.selectInput("projectoption-aspect", (value) => {
      return this.aspectChanged(value);
    });
    this.selectInput("projectoption-type", (value) => {
      return this.typeChanged(value);
    });
    this.selectInput("projectoption-graphics", (value) => {
      return this.graphicsChanged(value);
    });
    this.selectInput("projectoption-graphics-version", (value) => {
      return this.graphicsChanged(value);
    });
    this.selectInput("projectoption-language", (value) => {
      return this.languageChanged(value);
    });
    this.checkInput("projectoption-networking", (value) => {
      return this.networkingChanged(value);
    });
    advanced = document.getElementById("advanced-project-options-button");
    advanced.addEventListener("click", () => {
      if (advanced.classList.contains("open")) {
        advanced.classList.remove("open");
        document.getElementById("advanced-project-options").style.display = "none";
        return advanced.childNodes[1].innerText = this.app.translator.get("Show advanced options");
      } else {
        advanced.classList.add("open");
        document.getElementById("advanced-project-options").style.display = "block";
        return advanced.childNodes[1].innerText = this.app.translator.get("Hide advanced options");
      }
    });
    this.app.appui.setAction("add-project-user", () => {
      return this.addProjectUser();
    });
    document.getElementById("add-project-user-nick").addEventListener("keyup", (event) => {
      if (event.keyCode === 13) {
        return this.addProjectUser();
      }
    });
    list = document.querySelectorAll("#project-option-libs input");
    for (j = 0, len = list.length; j < len; j++) {
      input = list[j];
      ((input) => {
        var id, key, option, ref, value, version_e;
        id = input.id.split("-");
        id = id[id.length - 1];
        if (ms_optional_libs[id] != null) {
          version_e = document.getElementById(`project-option-lib-${id}-version`);
          if (ms_optional_libs[id].versions != null) {
            ref = ms_optional_libs[id].versions;
            for (key in ref) {
              value = ref[key];
              option = document.createElement("option");
              option.value = key;
              option.innerText = value.name;
              version_e.appendChild(option);
            }
            this.selectInput(version_e.id, (value) => {
              this.addLib(value);
              return this.libsChanged();
            });
          } else {
            version_e.style.display = "none";
          }
        }
        return input.addEventListener("change", () => {
          if (input.checked) {
            this.addLib(id);
            return this.libsChanged();
          } else {
            this.removeLib(id);
            return this.libsChanged();
          }
        });
      })(input);
    }
    this.library_tip = document.querySelector("#project-option-type .library");
  }

  textInput(element, action) {
    var e;
    e = document.getElementById(element);
    return e.addEventListener("input", (event) => {
      return action(e.value);
    });
  }

  selectInput(element, action) {
    var e;
    e = document.getElementById(element);
    return e.addEventListener("change", (event) => {
      return action(e.options[e.selectedIndex].value);
    });
  }

  checkInput(element, action) {
    var e;
    e = document.getElementById(element);
    return e.addEventListener("change", (event) => {
      return action(e.checked);
    });
  }

  projectOpened() {
    document.getElementById("projectoptions-icon").src = this.app.project.getFullURL() + "icon.png";
    //document.getElementById("projectoptions-icon").setAttribute("src","#{@app.project.getFullURL()}icon.png")
    document.getElementById("projectoption-name").value = this.app.project.title;
    this.project_slug_validator.set(this.app.project.slug);
    document.getElementById("projectoption-slugprefix").innerText = location.origin.replace(".dev", ".io") + `/${this.app.project.owner.nick}/`;
    document.getElementById("projectoption-orientation").value = this.app.project.orientation;
    document.getElementById("projectoption-aspect").value = this.app.project.aspect;
    document.getElementById("projectoption-type").value = this.app.project.type || "app";
    document.getElementById("projectoption-graphics").value = (this.app.project.graphics || "M1").split("_")[0];
    document.getElementById("projectoption-language").value = this.app.project.language || "microscript_v1_i";
    document.getElementById("projectoption-networking").checked = this.app.project.networking || false;
    this.library_tip.style.display = this.app.project.type === "library" ? "block" : "none";
    this.updateOptionalLibs();
    this.updateSecretCodeLine();
    this.updateUserList();
    this.app.project.addListener(this);
    if (window.ms_standalone || this.app.user.flags.guest) {
      document.querySelector("#projectoptions-users-content").style.display = "none";
    } else {
      document.querySelector("#projectoptions-users-content").style.display = "block";
    }
    return this.updateGraphicsVersion();
  }

  updateGraphicsVersion() {
    var e, full_id, graphics, id, key, option, ref, ref1, v;
    e = document.getElementById("projectoption-graphics-version");
    full_id = this.app.project.graphics || "M1";
    id = full_id.split("_")[0].toLowerCase();
    graphics = ms_graphics_options[id];
    if (graphics) {
      if (graphics.versions) {
        e.innerHTML = "";
        ref = graphics.versions;
        for (key in ref) {
          v = ref[key];
          option = document.createElement("option");
          option.value = key.toUpperCase();
          option.innerText = v.name;
          e.appendChild(option);
        }
        if (graphics.versions[full_id.toLowerCase()]) {
          e.value = full_id;
        } else {
          ref1 = graphics.versions;
          for (key in ref1) {
            v = ref1[key];
            if (v.original) {
              e.value = key.toUpperCase();
            }
          }
        }
        return e.style.display = "inline-block";
      } else {
        return e.style.display = "none";
      }
    } else {
      return e.style.display = "none";
    }
  }

  updateOptionalLibs() {
    var checked, e, id, input, j, k, key, len, len1, lib, list, optlib, ref, results, v, value, version;
    list = document.querySelectorAll("#project-option-libs input");
    results = [];
    for (j = 0, len = list.length; j < len; j++) {
      input = list[j];
      input.checked = false;
      id = input.id;
      id = id.split("-");
      id = id[id.length - 1];
      e = document.getElementById(`project-option-lib-${id}`);
      v = document.getElementById(`project-option-lib-${id}-version`);
      checked = false;
      version = null;
      optlib = null;
      ref = this.app.project.libs;
      for (k = 0, len1 = ref.length; k < len1; k++) {
        lib = ref[k];
        if (lib.startsWith(id)) {
          checked = true;
          version = lib;
          optlib = ms_optional_libs[id];
        }
      }
      e.checked = checked;
      if (checked && (optlib.versions != null)) {
        v.style.display = "inline-block";
        if (optlib.versions[version] != null) {
          results.push(v.value = version);
        } else {
          results.push((function() {
            var ref1, results1;
            ref1 = optlib.versions;
            results1 = [];
            for (key in ref1) {
              value = ref1[key];
              if (value.original) {
                results1.push(v.value = key);
              } else {
                results1.push(void 0);
              }
            }
            return results1;
          })());
        }
      } else {
        results.push(v.style.display = "none");
      }
    }
    return results;
  }

  updateSecretCodeLine() {
    this.project_code_validator.set(this.app.project.code);
    return document.getElementById("projectoption-codeprefix").innerText = location.origin.replace(".dev", ".io") + `/${this.app.project.owner.nick}/${this.app.project.slug}/`;
  }

  projectUpdate(name) {
    var icon;
    if (name === "spritelist") {
      icon = this.app.project.getSprite("icon");
      if (icon != null) {
        return icon.addImage(document.getElementById("projectoptions-icon"), 160);
      }
    }
  }

  update() {
    var storage;
    storage = this.app.appui.displayByteSize(this.app.project.getSize());
    return document.getElementById("projectoption-storage-used").innerText = storage;
  }

  optionChanged(name, value) {
    if ((value.trim != null) && value.trim().length === 0) {
      return;
    }
    switch (name) {
      case "title":
        this.app.project.setTitle(value);
        break;
      case "slug":
        if (value !== RegexLib.slugify(value)) {
          value = RegexLib.slugify(value);
          this.project_slug_validator.set(value);
        }
        if (value.length === 0 || value === this.app.project.slug) {
          return;
        }
        this.app.project.setSlug(value);
        this.updateSecretCodeLine();
        break;
      case "code":
        this.app.project.setCode(value);
    }
    return this.app.client.sendRequest({
      name: "set_project_option",
      project: this.app.project.id,
      option: name,
      value: value
    }, (msg) => {
      if (msg.name === "error" && (msg.value != null)) {
        switch (name) {
          case "title":
            document.getElementById("projectoption-name").value = msg.value;
            return this.app.project.setTitle(msg.value);
          case "slug":
            this.project_slug_validator.set(msg.value);
            this.app.project.setSlug(msg.value);
            return this.updateSecretCodeLine();
        }
      }
    });
  }

  orientationChanged(value) {
    this.app.project.setOrientation(value);
    return this.app.client.sendRequest({
      name: "set_project_option",
      project: this.app.project.id,
      option: "orientation",
      value: value
    }, (msg) => {});
  }

  aspectChanged(value) {
    this.app.project.setAspect(value);
    return this.app.client.sendRequest({
      name: "set_project_option",
      project: this.app.project.id,
      option: "aspect",
      value: value
    }, (msg) => {});
  }

  typeChanged(value) {
    this.app.project.setType(value);
    this.library_tip.style.display = value === "library" ? "block" : "none";
    this.app.client.sendRequest({
      name: "set_project_option",
      project: this.app.project.id,
      option: "type",
      value: value
    }, (msg) => {});
    this.app.tab_manager.resetPlugins();
    return this.app.lib_manager.resetLibs();
  }

  graphicsChanged(value) {
    var graphics, id, key, ref, v;
    id = value.split("_")[0];
    if (id === value) {
      graphics = ms_graphics_options[id.toLowerCase()];
      if (graphics && graphics.versions) {
        ref = graphics.versions;
        for (key in ref) {
          v = ref[key];
          if (v.default) {
            value = key.toUpperCase();
            break;
          }
        }
      }
    }
    this.app.project.setGraphics(value);
    this.app.debug.updateDebuggerVisibility();
    this.updateGraphicsVersion();
    return this.app.client.sendRequest({
      name: "set_project_option",
      project: this.app.project.id,
      option: "graphics",
      value: value
    }, (msg) => {});
  }

  fixLib(lib) {
    var key, ref, value;
    if ((ms_optional_libs[lib] != null) && ms_optional_libs[lib].versions) {
      ref = ms_optional_libs[lib].versions;
      for (key in ref) {
        value = ref[key];
        if (value.default) {
          return key;
        }
      }
    }
    return lib;
  }

  addLib(lib) {
    this.removeLib(lib);
    return this.app.project.libs.push(this.fixLib(lib));
  }

  removeLib(lib) {
    var i, id, j, l, ref, results;
    id = lib.split("_")[0];
    results = [];
    for (i = j = ref = this.app.project.libs.length - 1; j >= 0; i = j += -1) {
      l = this.app.project.libs[i];
      if (l.split("_")[0] === id) {
        results.push(this.app.project.libs.splice(i, 1));
      } else {
        results.push(void 0);
      }
    }
    return results;
  }

  libsChanged() {
    this.optionChanged("libs", this.app.project.libs);
    return this.updateOptionalLibs();
  }

  languageChanged(value) {
    if (value !== this.app.project.language) {
      if (this.app.project.source_list.length === 1 && this.app.project.source_list[0].content.split("\n").length < 20) {
        if (!this.app.project.language.startsWith("microscript") || !value.startsWith("microscript")) {
          ConfirmDialog.confirm(this.app.translator.get("Your current code will be overwritten. Do you wish to proceed?"), this.app.translator.get("OK"), this.app.translator.get("Cancel"), (() => {
            this.app.project.setLanguage(value);
            this.app.editor.updateLanguage();
            this.app.debug.updateDebuggerVisibility();
            if (DEFAULT_CODE[value] != null) {
              this.app.editor.setCode(DEFAULT_CODE[value]);
            } else {
              this.app.editor.setCode(DEFAULT_CODE["microscript"]);
            }
            this.app.editor.editorContentsChanged();
            return this.setLanguage(value);
          }), (() => {
            return document.getElementById("projectoption-language").value = this.app.project.language;
          }));
          return;
        }
      }
      return this.setLanguage(value);
    }
  }

  setLanguage(value) {
    this.app.project.setLanguage(value);
    this.app.editor.updateLanguage();
    this.app.debug.updateDebuggerVisibility();
    return this.app.client.sendRequest({
      name: "set_project_option",
      project: this.app.project.id,
      option: "language",
      value: value
    }, (msg) => {});
  }

  networkingChanged(value) {
    this.app.project.networking = value;
    this.app.runwindow.updateServerBar();
    this.app.publish.updateServerExport();
    return this.app.client.sendRequest({
      name: "set_project_option",
      project: this.app.project.id,
      option: "networking",
      value: value
    }, (msg) => {});
  }

  setType(type) {
    if (type !== this.app.project.type) {
      console.info(`setting type to ${type}`);
      this.app.project.setType(type);
      return this.app.client.sendRequest({
        name: "set_project_option",
        project: this.app.project.id,
        option: "type",
        value: type
      }, (msg) => {});
    }
  }

  addProjectUser() {
    var nick;
    nick = document.getElementById("add-project-user-nick").value;
    if (nick.trim().length > 0) {
      this.app.client.sendRequest({
        name: "invite_to_project",
        project: this.app.project.id,
        user: nick
      }, (msg) => {
        return console.info(msg);
      });
      return document.getElementById("add-project-user-nick").value = "";
    }
  }

  updateUserList() {
    var div, j, len, ref, user;
    div = document.getElementById("project-user-list");
    div.innerHTML = "";
    ref = this.app.project.users;
    for (j = 0, len = ref.length; j < len; j++) {
      user = ref[j];
      ((user) => {
        var e, name, remove;
        e = document.createElement("div");
        e.classList.add("user");
        name = document.createElement("div");
        name.classList.add("username");
        name.innerHTML = user.nick + " " + (user.accepted ? "<i class='fa fa-check'></i>" : "<i class='fa fa-clock'></i>");
        remove = document.createElement("div");
        remove.classList.add("remove");
        remove.innerHTML = "<i class='fa fa-times'></i> Remove";
        remove.addEventListener("click", (event) => {
          return this.app.client.sendRequest({
            name: "remove_project_user",
            project: this.app.project.id,
            user: user.nick
          });
        });
        e.appendChild(remove);
        e.appendChild(name);
        return div.appendChild(e);
      })(user);
    }
  }

};

DEFAULT_CODE = {
  python: "def init():\n  pass\n\ndef update():\n  pass\n\ndef draw():\n  pass",
  javascript: "init = function() {\n}\n\nupdate = function() {\n}\n\ndraw = function() {\n}",
  lua: "init = function()\nend\n\nupdate = function()\nend\n\ndraw = function()\nend",
  microscript: "init = function()\nend\n\nupdate = function()\nend\n\ndraw = function()\nend"
};

this.TabManager = (function() {
  class TabManager {
    constructor(app) {
      this.app = app;
      this.initProjectTabSelection();
      this.known_plugins = {};
      this.plugin_views = {};
    }

    projectOpened() {
      this.updateProjectTabSelection();
      return this.updatePluginSelection();
    }

    isTabActive(t) {
      var p, tabs;
      p = this.app.project;
      if (!p) {
        return false;
      }
      tabs = p.tabs || {};
      if (tabs[t] != null) {
        return tabs[t];
      } else {
        return TabManager.DEFAULT_TABS[t];
      }
    }

    setTabActive(t, active) {
      var p;
      p = this.app.project;
      if (p.tabs == null) {
        p.tabs = {};
      }
      p.tabs[t] = active;
      this.updateProjectTabs();
      return this.app.client.sendRequest({
        name: "set_project_option",
        project: this.app.project.id,
        option: "tabs",
        value: p.tabs
      }, (msg) => {});
    }

    updateProjectTabSelection() {
      var element, tab;
      for (tab in TabManager.DEFAULT_TABS) {
        element = document.getElementById(`project-option-active-tab-${tab}`);
        if (element != null) {
          element.checked = this.isTabActive(tab);
        }
      }
    }

    updateProjectTabs() {
      var element, i, id, len, list, plugins, tab, value;
      for (tab in TabManager.DEFAULT_TABS) {
        element = document.getElementById(`menuitem-${tab}`);
        if (element != null) {
          element.style.display = this.isTabActive(tab) ? "block" : "none";
        }
      }
      plugins = this.app.project.plugins || {};
      list = document.querySelectorAll(".menuitem-plugin");
      for (i = 0, len = list.length; i < len; i++) {
        element = list[i];
        id = element.id.split("-")[1] * 1;
        if (plugins[id] == null) {
          element.parentNode.removeChild(element);
          if (this.plugin_views[id] != null) {
            this.plugin_views[id].close();
            delete this.plugin_views[id];
          }
          this.app.documentation.removePlugin(id);
        }
      }
      for (id in plugins) {
        value = plugins[id];
        element = document.getElementById(`menuitem-${id}`);
        if (!element) {
          this.createPluginUI(id);
        }
      }
    }

    initProjectTabSelection() {
      var tab;
      for (tab in TabManager.DEFAULT_TABS) {
        ((tab) => {
          var element;
          element = document.getElementById(`project-option-active-tab-${tab}`);
          return element.addEventListener("change", () => {
            return this.setTabActive(tab, !this.isTabActive(tab));
          });
        })(tab);
      }
    }

    createPluginBox(project) {
      var desc, div, e, i, id, len, list, nick, path, plugins, user;
      console.info(project);
      nick = typeof project.owner === "string" ? project.owner : project.owner.nick;
      id = project.id;
      path = `/${nick}/${project.slug}`;
      if (project.code != null) {
        path += `/${project.code}`;
      }
      this.known_plugins[id] = {
        nick: nick,
        slug: project.slug,
        title: project.title,
        code: project.code,
        url: `${location.origin}${path}/`
      };
      div = document.createElement("div");
      div.classList.add("plugin-box");
      div.dataset.id = id;
      desc = project.description;
      if (desc.length > 300) {
        desc = desc.substring(0, 300) + " (...)";
      }
      div.innerHTML = `<img class="pixelated icon" src="${location.origin}${path}/sprites/icon.png"/>\n<div class="description md dark">\n  <div class="plugin-author"></div>\n  <h4>${project.title}</h4>\n  <p>${DOMPurify.sanitize(marked(desc))}</p>\n  <div class="plugin-folder">\n    <label for="plugin-folder-${id}">Working folder</label><br/>\n    <input id="plugin-folder-${id}" type="text" value="${project.slug}"></input><br/>\n    This plugin file access will be restricted to the specified folder (or to the root folder if left blank).\n  </div>\n  <i class="fa fa-check check"></i>\n</div>`;
      list = div.getElementsByTagName("a");
      for (i = 0, len = list.length; i < len; i++) {
        e = list[i];
        e.target = "_blank";
      }
      if (project.owner_info) {
        user = this.app.appui.createUserTag(nick, project.owner_info.tier, project.owner_info.profile_image, 20);
      } else if (project.owner.nick === this.app.user.nick) {
        user = this.app.appui.createUserTag(this.app.user.nick, this.app.user.flags.tier || "", this.app.user.flags.profile_image, 20);
      } else {
        user = this.app.appui.createUserTag(project.owner.nick, "", false, 20);
      }
      div.querySelector(".plugin-author").appendChild(user);
      div.id = `plugin-box-${id}`;
      plugins = this.app.project.plugins || {};
      if ((plugins[id] != null) && (plugins[id].folder != null)) {
        div.querySelector("input").value = plugins[id].folder;
      }
      div.querySelector("input").addEventListener("keydown", (event) => {
        var prop;
        if (event.key === "Enter") {
          prop = `input_validation_${id}`;
          if (this[prop]) {
            clearTimeout(this[prop]);
          }
          this.updatePluginFolder(id);
          return div.querySelector("input").blur();
        }
      });
      div.querySelector("input").addEventListener("input", () => {
        var prop;
        prop = `input_validation_${id}`;
        if (this[prop]) {
          clearTimeout(this[prop]);
        }
        return this[prop] = setTimeout((() => {
          this.updatePluginFolder(id);
          return div.querySelector("input").blur();
        }), 2000);
      });
      div.addEventListener("click", () => {
        if (div.querySelector("input") !== document.activeElement) {
          return this.togglePlugin(id);
        }
      });
      return div;
    }

    togglePlugin(id) {
      var folder;
      if (this.isPluginActive(id)) {
        return this.setPluginActive(id, false);
      } else {
        folder = RegexLib.fixFilePath(document.querySelector(`#plugin-box-${id} input`).value);
        return this.setPluginActive(id, true, folder);
      }
    }

    updatePluginFolder(id) {
      var e;
      if (this.isPluginActive(id)) {
        e = document.querySelector(`#plugin-box-${id} input`);
        e.value = RegexLib.fixFilePath(e.value);
        this.setPluginActive(id, true, e.value);
        if (this.plugin_views[id] != null) {
          return this.plugin_views[id].setFolder(e.value);
        }
      }
    }

    resetPlugins() {
      return this.plugins_fetched = false;
    }

    fetchAvailablePlugins(callback) {
      var box, i, len, p, ref, your_list, your_plugins;
      if (this.plugins_fetched) {
        return callback();
      }
      this.plugins_fetched = true;
      your_plugins = document.querySelector("#project-tabs-your-plugins");
      your_list = document.querySelector("#project-tabs-your-plugins .plugin-list");
      your_list.innerHTML = "";
      ref = this.app.projects;
      for (i = 0, len = ref.length; i < len; i++) {
        p = ref[i];
        if (p.type === "plugin") {
          box = this.createPluginBox(p);
          your_list.appendChild(box);
        }
      }
      if (your_list.childNodes.length === 0) {
        your_plugins.style.display = "none";
      } else {
        your_plugins.style.display = "block";
      }
      return this.app.client.sendRequest({
        name: "get_public_plugins"
      }, (msg) => {
        var j, len1, public_list, public_plugins, ref1;
        console.info(msg.list);
        public_plugins = document.querySelector("#project-tabs-public-plugins");
        public_list = document.querySelector("#project-tabs-public-plugins .plugin-list");
        ref1 = msg.list;
        for (j = 0, len1 = ref1.length; j < len1; j++) {
          p = ref1[j];
          if (this.known_plugins[p.id] == null) {
            box = this.createPluginBox(p);
            public_list.appendChild(box);
          }
        }
        if (public_list.childNodes.length === 0) {
          public_plugins.style.display = "none";
        } else {
          public_plugins.style.display = "block";
        }
        return callback();
      });
    }

    updatePluginSelection() {
      return this.fetchAvailablePlugins(() => {
        var e, i, len, list, plugins;
        list = document.querySelectorAll(".plugin-box");
        plugins = this.app.project.plugins || {};
        for (i = 0, len = list.length; i < len; i++) {
          e = list[i];
          if (plugins[e.dataset.id]) {
            e.classList.add("selected");
          } else {
            e.classList.remove("selected");
          }
        }
        this.updateProjectTabs();
      });
    }

    isPluginActive(id) {
      var p, plugins;
      p = this.app.project;
      if (!p) {
        return false;
      }
      plugins = p.plugins || {};
      return plugins[id] != null;
    }

    setPluginActive(id, active, folder = "plugin") {
      var p;
      p = this.app.project;
      if (p.plugins == null) {
        p.plugins = {};
      }
      if (active) {
        p.plugins[id] = {
          folder: folder
        };
      } else {
        delete p.plugins[id];
      }
      this.updatePluginSelection();
      this.updateProjectTabs();
      return this.app.client.sendRequest({
        name: "set_project_option",
        project: this.app.project.id,
        option: "plugins",
        value: p.plugins
      }, (msg) => {});
    }

    createPluginUI(id) {
      var data, doc_url, last, li, parent, path;
      data = this.known_plugins[id];
      if (data == null) {
        return;
      }
      if (data.code != null) {
        path = `${data.nick}/${data.slug}/${data.code}`;
      } else {
        path = `${data.nick}/${data.slug}`;
      }
      li = document.createElement("li");
      li.classList.add("menuitem-plugin");
      li.id = `menuitem-${id}`;
      li.innerHTML = `<img class="pixelated" src="/${path}/sprites/icon.png" />\n<br>\n<span>${data.title}</span>`;
      parent = document.querySelector("#sidemenu ul");
      last = document.getElementById("menuitem-tabs");
      li.addEventListener("click", () => {
        return this.app.appui.setSection(id);
      });
      parent.insertBefore(li, last);
      doc_url = `${location.origin}/${path}/doc/doc.md`;
      return this.app.documentation.addPlugin(id, data.title, doc_url);
    }

    setTabView(id) {
      var data, ref, settings, view, viewid;
      ref = this.plugin_views;
      for (viewid in ref) {
        view = ref[viewid];
        if (viewid !== id) {
          view.hide();
        }
      }
      view = this.plugin_views[id];
      if (view == null) {
        data = this.known_plugins[id];
        if (data == null) {
          return;
        }
        settings = this.app.project.plugins[id];
        if (settings == null) {
          return;
        }
        data.folder = settings.folder;
        this.plugin_views[id] = view = new PluginView(this.app, data);
      }
      return view.show();
    }

    projectClosed() {
      var element, i, id, len, list, ref, view;
      ref = this.plugin_views;
      for (id in ref) {
        view = ref[id];
        view.close();
      }
      list = document.querySelectorAll(".menuitem-plugin");
      for (i = 0, len = list.length; i < len; i++) {
        element = list[i];
        element.parentNode.removeChild(element);
      }
      this.plugin_views = {};
      this.app.documentation.removeAllPlugins();
    }

  };

  TabManager.DEFAULT_TABS = {
    code: true,
    sprites: true,
    maps: true,
    sounds: true,
    music: true,
    assets: false,
    sync: false,
    doc: true,
    publish: true
  };

  return TabManager;

}).call(this);

this.PluginView = (function() {
  function PluginView(app, data1) {
    this.app = app;
    this.data = data1;
    this.access = new ProjectAccess(this.app, this.data.folder, this);
  }

  PluginView.prototype.createElement = function() {
    this.element = document.createElement("div");
    this.element.classList.add("plugin-view");
    this.element.style.display = "none";
    document.getElementById("section-container").appendChild(this.element);
    this.element.innerHTML = "<div class=\"plugin-view-container\"><iframe allow='autoplay;gamepad' src='" + this.data.url + "?debug'></iframe></div>";
    this.message_listener = (function(_this) {
      return function(msg) {
        if (msg.source === _this.element.querySelector("iframe").contentWindow) {
          return _this.messageReceived(JSON.parse(msg.data));
        }
      };
    })(this);
    return window.addEventListener("message", this.message_listener);
  };

  PluginView.prototype.show = function() {
    if (this.element == null) {
      this.createElement();
    }
    return this.element.style.display = "block";
  };

  PluginView.prototype.hide = function() {
    if (this.element != null) {
      return this.element.style.display = "none";
    }
  };

  PluginView.prototype.setFolder = function(folder) {
    return this.access.setFolder(folder);
  };

  PluginView.prototype.messageReceived = function(msg) {
    return this.access.messageReceived(msg);
  };

  PluginView.prototype.postMessage = function(data) {
    if (this.element != null) {
      return this.element.querySelector("iframe").contentWindow.postMessage(JSON.stringify(data), "*");
    }
  };

  PluginView.prototype.close = function() {
    if (this.message_listener != null) {
      window.removeEventListener("message", this.message_listener);
    }
    if (this.element != null) {
      return document.getElementById("section-container").removeChild(this.element);
    }
  };

  return PluginView;

})();

this.Sync = (function() {
  function Sync(app) {
    this.app = app;
    this.select = document.getElementById("project-sync-source");
    this.project_sync_list = document.getElementById("project-sync-list");
    this.project_sync_proceed = document.getElementById("project-sync-proceed");
    this.project_sync_input = document.querySelector("#project-sync-proceed input");
    this.project_sync_button = document.querySelector("#project-sync-proceed .proceed");
    this.project_sync_button.addEventListener("click", (function(_this) {
      return function() {
        console.info(_this.checklist);
        return _this.app.client.sendRequest({
          name: "sync_project_files",
          ops: _this.checklist,
          source: _this.source.id,
          dest: _this.app.project.id
        }, function(msg) {
          console.info(msg);
          _this.app.project.load();
          return _this.diff();
        });
      };
    })(this));
    this.select.addEventListener("change", (function(_this) {
      return function(event) {
        var i, id, len, p, ref;
        id = _this.select.options[_this.select.selectedIndex].value * 1;
        ref = _this.app.projects;
        for (i = 0, len = ref.length; i < len; i++) {
          p = ref[i];
          if (p.id === id) {
            _this.source = p;
            _this.diff();
            _this.app.client.sendRequest({
              name: "set_project_property",
              project: _this.app.project.id,
              property: "sync_source",
              value: p.id
            });
            return;
          }
        }
        _this.app.client.sendRequest({
          name: "set_project_property",
          project: _this.app.project.id,
          property: "sync_source"
        });
        _this.project_sync_list.innerHTML = "";
        return _this.project_sync_proceed.style.display = "none";
      };
    })(this));
    this.project_sync_input.addEventListener("input", (function(_this) {
      return function(event) {
        if (_this.project_sync_input.value === "SYNC NOW") {
          return _this.project_sync_button.style.display = "inline-block";
        } else {
          return _this.project_sync_button.style.display = "none";
        }
      };
    })(this));
  }

  Sync.prototype.projectOpened = function() {
    return this.reset();
  };

  Sync.prototype.reset = function() {
    this.select.innerHTML = "";
    this.project_sync_list.innerHTML = "";
    this.project_sync_proceed.style.display = "none";
    this.project_sync_input.value = "";
    return this.project_sync_button.style.display = "none";
  };

  Sync.prototype.update = function() {
    var i, len, option, option_none, p, ref, results;
    this.select.innerHTML = "";
    if (this.app.projects != null) {
      option_none = document.createElement("option");
      option_none.value = -1;
      option_none.innerText = this.app.translator.get("No source project");
      option_none.name = "";
      option_none.selected = true;
      this.select.appendChild(option_none);
      ref = this.app.projects;
      results = [];
      for (i = 0, len = ref.length; i < len; i++) {
        p = ref[i];
        if (p.id !== this.app.project.id) {
          option = document.createElement("option");
          option.value = p.id;
          option.innerText = p.title + ("    - [" + p.slug + "]");
          option.name = p.slug;
          this.select.appendChild(option);
          if ((this.app.project != null) && this.app.project.properties.sync_source === p.id) {
            option_none.selected = false;
            option.selected = true;
            this.source = p;
            results.push(this.diff());
          } else {
            results.push(void 0);
          }
        } else {
          results.push(void 0);
        }
      }
      return results;
    }
  };

  Sync.prototype.diff = function() {
    var text;
    text = this.app.translator.get("The following changes will be made to your project %PROJECT%:").replace("%PROJECT%", this.app.project.title + "  - [" + this.app.project.slug + "]");
    this.project_sync_list.innerHTML = "<h3>" + text + "</h3>";
    this.source_view = new Sync.ProjectView(this.app, this.source.id);
    this.checklist = [];
    return this.source_view.load((function(_this) {
      return function() {
        _this.dest_view = new Sync.ProjectView(_this.app, _this.app.project.id);
        return _this.dest_view.load(function() {
          var f, file, hr_path, path, ref, ref1, s;
          ref = _this.source_view.files;
          for (path in ref) {
            file = ref[path];
            f = _this.dest_view.files[path];
            hr_path = path.replace(/-/g, "/");
            if (f == null) {
              _this.addSyncLine("create", _this.app.translator.get("File %FILE% will be created").replace("%FILE%", hr_path));
              _this.checklist.push({
                op: "sync",
                file: file
              });
            } else if (file.version > f.version) {
              _this.addSyncLine("upgrade", _this.app.translator.get("File %FILE% will be upgraded from version %V1% to version %V2%").replace("%FILE%", hr_path).replace("%V1%", f.version).replace("%V2%", file.version));
              _this.checklist.push({
                op: "sync",
                file: file
              });
            } else if (file.version < f.version) {
              _this.addSyncLine("downgrade", _this.app.translator.get("File %FILE% will be downgraded from version %V1% to version %V2%").replace("%FILE%", hr_path).replace("%V1%", f.version).replace("%V2%", file.version));
              _this.checklist.push({
                op: "sync",
                file: file
              });
            } else if (file.size !== f.size) {
              _this.addSyncLine("sync", _this.app.translator.get("File %FILE% will be changed").replace("%FILE%", hr_path));
              _this.checklist.push({
                op: "sync",
                file: file
              });
            }
          }
          ref1 = _this.dest_view.files;
          for (path in ref1) {
            file = ref1[path];
            s = _this.source_view.files[path];
            hr_path = path.replace(/-/g, "/");
            if (s == null) {
              _this.addSyncLine("delete", _this.app.translator.get("File %FILE% will be deleted").replace("%FILE%", hr_path));
              _this.checklist.push({
                op: "delete",
                file: file
              });
            }
          }
          if (_this.checklist.length === 0) {
            text = _this.app.translator.get("Your project is 100% in sync with %PROJECT%").replace("%PROJECT%", _this.source.title + "  - [" + _this.source.slug + "]");
            _this.project_sync_list.innerHTML = "<h3>" + text + "</h3>";
            return _this.project_sync_proceed.style.display = "none";
          } else {
            return _this.project_sync_proceed.style.display = "block";
          }
        });
      };
    })(this));
  };

  Sync.prototype.addSyncLine = function(type, text) {
    var div;
    div = document.createElement("div");
    div.classList.add(type);
    div.innerHTML = "<i class=\"fa\"></i> " + text;
    return this.project_sync_list.appendChild(div);
  };

  Sync.prototype.fetchList = function(folder) {
    return this.app.client.sendRequest({
      name: "list_project_files",
      project: this.app.project.id,
      folder: folder
    }, (function(_this) {
      return function(msg) {
        return _this[callback](msg.files);
      };
    })(this));
  };

  return Sync;

})();

this.Sync.ProjectView = (function() {
  function ProjectView(app, id1) {
    this.app = app;
    this.id = id1;
    this.files = {};
  }

  ProjectView.prototype.load = function(callback) {
    var funk, list;
    list = ["ms", "sprites", "maps", "sounds", "music", "assets", "doc"];
    funk = (function(_this) {
      return function() {
        var e;
        if (list.length > 0) {
          e = list.splice(0, 1)[0];
          return _this.fetch(e, funk);
        } else {
          return callback();
        }
      };
    })(this);
    return funk();
  };

  ProjectView.prototype.fetch = function(folder, next) {
    return this.app.client.sendRequest({
      name: "list_project_files",
      project: this.id,
      folder: folder
    }, (function(_this) {
      return function(msg) {
        var f, i, len, path, ref;
        ref = msg.files;
        for (i = 0, len = ref.length; i < len; i++) {
          f = ref[i];
          console.info(f);
          path = folder + "/" + f.file;
          _this.files[path] = f;
          f.path = path;
        }
        return next();
      };
    })(this));
  };

  return ProjectView;

})();

this.Publish = class Publish {
  constructor(app) {
    this.app = app;
    this.app.appui.setAction("publish-button", () => {
      return this.setProjectPublic(true);
    });
    this.app.appui.setAction("unpublish-button", () => {
      return this.setProjectPublic(false);
    });
    this.tags_validator = new InputValidator(document.getElementById("publish-add-tags"), document.getElementById("publish-add-tags-button"), null, (value) => {
      return this.addTags(value[0]);
    });
    this.description_save = 0;
    document.querySelector("#publish-box-textarea").addEventListener("input", () => {
      return this.description_save = Date.now() + 2000;
    });
    setInterval((() => {
      return this.checkDescriptionSave();
    }), 1000);
    this.builders = [];
    this.builders.push(new AppBuild(this.app, "android"));
    this.builders.push(new AppBuild(this.app, "windows"));
    this.builders.push(new AppBuild(this.app, "macos"));
    this.builders.push(new AppBuild(this.app, "linux"));
    this.builders.push(new AppBuild(this.app, "raspbian"));
    document.getElementById("publish-listed").addEventListener("change", () => {
      if (this.app.project != null) {
        this.app.project.unlisted = !document.getElementById("publish-listed").checked;
        this.app.options.optionChanged("unlisted", !document.getElementById("publish-listed").checked);
        this.sendProjectPublic(this.app.project.public);
        return this.updateCheckList();
      }
    });
  }

  loadProject(project) {
    var b, build, j, len, public_url, ref;
    if (project.public) {
      document.getElementById("publish-box").style.display = "none";
      document.getElementById("unpublish-box").style.display = "block";
    } else {
      document.getElementById("publish-box").style.display = "block";
      document.getElementById("unpublish-box").style.display = "none";
    }
    document.getElementById("publish-validate-first").style.display = this.app.user.flags["validated"] ? "none" : "block";
    document.getElementById("publish-listed").checked = !project.unlisted;
    this.updateCheckList();
    public_url = `${location.origin.replace(".dev", ".io")}/i/${this.app.project.owner.nick}/${this.app.project.slug}/`;
    document.getElementById("publish-public-link").href = public_url;
    document.getElementById("publish-public-link").innerText = public_url;
    document.querySelector("#publish-box-textarea").value = project.description;
    this.updateTags();
    project.addListener(this);
    if (this.app.user.flags["validated"]) {
      document.querySelector("#publish-box .publish-button").classList.remove("disabled");
    } else {
      document.querySelector("#publish-box .publish-button").classList.add("disabled");
    }
    b = document.querySelector("#html-export .publish-button");
    b.onclick = () => {
      var loc;
      loc = `/${project.owner.nick}/${project.slug}/`;
      if (!project.public) {
        loc += project.code + "/";
      }
      return window.location = loc + "publish/html/?v=" + Date.now();
    };
    b = document.querySelector("#server-export .publish-button");
    b.onclick = () => {
      var loc;
      loc = `/${project.owner.nick}/${project.slug}/`;
      if (!project.public) {
        loc += project.code + "/";
      }
      return window.location = loc + "publish/html/?server&v=" + Date.now();
    };
    ref = this.builders;
    for (j = 0, len = ref.length; j < len; j++) {
      build = ref[j];
      build.loadProject(project);
    }
    this.updateServerExport();
  }

  updateServerExport() {
    return document.querySelector("#publish-box-server").style.display = (this.app.project != null) && this.app.project.networking ? "block" : "none";
  }

  updateCheckList() {
    var project;
    project = this.app.project;
    if (project.public && !project.unlisted && !this.app.user.flags.approved && !project.flags.approved) {
      return document.getElementById("publish-checklist").style.display = "block";
    } else {
      return document.getElementById("publish-checklist").style.display = "none";
    }
  }

  updateTags() {
    var j, len, list, ref, t;
    list = document.getElementById("publish-tag-list");
    list.innerHTML = "";
    ref = this.app.project.tags;
    for (j = 0, len = ref.length; j < len; j++) {
      t = ref[j];
      ((t) => {
        var e, i, span;
        e = document.createElement("div");
        t = t.replace(/[<>&;"']/g, "");
        span = document.createElement("span");
        span.innerText = t;
        e.appendChild(span);
        i = document.createElement("i");
        i.classList.add("fa");
        i.classList.add("fa-times-circle");
        i.addEventListener("click", () => {
          return this.removeTag(t);
        });
        e.appendChild(i);
        return list.appendChild(e);
      })(t);
    }
  }

  removeTag(t) {
    var tags;
    tags = this.app.project.tags;
    if (tags.indexOf(t) >= 0) {
      tags.splice(tags.indexOf(t), 1);
      return this.app.client.sendRequest({
        name: "set_project_tags",
        project: this.app.project.id,
        tags: tags
      }, (msg) => {
        return this.updateTags();
      });
    }
  }

  addTags(value) {
    var change, j, len, tags, v;
    tags = this.app.project.tags;
    value = value.toLowerCase().split(",");
    change = false;
    for (j = 0, len = value.length; j < len; j++) {
      v = value[j];
      v = v.trim();
      if (tags.indexOf(v) < 0) {
        change = true;
        tags.push(v);
      }
    }
    if (change) {
      return this.app.client.sendRequest({
        name: "set_project_tags",
        project: this.app.project.id,
        tags: tags
      }, (msg) => {
        this.updateTags();
        return this.tags_validator.reset();
      });
    }
  }

  projectUpdate(type) {
    switch (type) {
      case "tags":
        return this.updateTags();
    }
  }

  checkDescriptionSave(force = false) {
    if (this.description_save > 0 && (Date.now() > this.description_save || force)) {
      this.description_save = 0;
      this.app.project.description = document.querySelector("#publish-box-textarea").value;
      return this.app.client.sendRequest({
        name: "set_project_option",
        project: this.app.project.id,
        option: "description",
        value: document.querySelector("#publish-box-textarea").value
      }, (msg) => {});
    }
  }

  setProjectPublic(pub) {
    if (pub && !this.app.user.flags["validated"]) {
      return;
    }
    if (pub) {
      document.getElementById("publish-checklist").style.display = "block";
      this.app.options.optionChanged("unlisted", true);
      document.getElementById("publish-listed").checked = false;
      this.app.project.unlisted = true;
    }
    this.checkDescriptionSave(true);
    this.sendProjectPublic(pub);
    return this.updateCheckList();
  }

  sendProjectPublic(pub) {
    if (this.app.project != null) {
      return this.app.client.sendRequest({
        name: "set_project_public",
        project: this.app.project.id,
        public: pub
      }, (msg) => {
        if (msg.public != null) {
          this.app.project.public = msg.public;
          this.app.project.notifyListeners("public");
          return this.loadProject(this.app.project);
        }
      });
    }
  }

};

this.AppBuild = (function() {
  function AppBuild(app, target) {
    this.app = app;
    this.target = target;
    this.button = document.querySelector("#" + this.target + "-export .publish-button");
    this.button.addEventListener("click", (function(_this) {
      return function() {
        return _this.buttonClicked();
      };
    })(this));
  }

  AppBuild.prototype.loadProject = function(project) {
    this.project = project;
    if (this.interval != null) {
      clearInterval(this.interval);
      this.interval = null;
    }
    return this.updateBuildStatus();
  };

  AppBuild.prototype.buttonClicked = function() {
    var loc;
    if (this.build == null) {
      return this.app.client.sendRequest({
        name: "build_project",
        project: this.project.id,
        target: this.target
      }, (function(_this) {
        return function(msg) {
          return _this.handleBuildStatus(msg.build);
        };
      })(this));
    } else if (this.build.progress === 100) {
      loc = "/" + this.project.owner.nick + "/" + this.project.slug + "/";
      if (!this.project["public"]) {
        loc += this.project.code + "/";
      }
      console.info(loc + ("download/" + this.target + "/") + ("?v=" + this.project.last_modified));
      return window.location = loc + ("download/" + this.target + "/") + ("?v=" + this.project.last_modified);
    }
  };

  AppBuild.prototype.updateBuildStatus = function() {
    return this.app.client.sendRequest({
      name: "get_build_status",
      project: this.project.id,
      target: this.target
    }, (function(_this) {
      return function(msg) {
        if (msg.active_target) {
          document.querySelector("#publish-box-" + _this.target).style.display = "block";
        } else {
          document.querySelector("#publish-box-" + _this.target).style.display = "none";
        }
        return _this.handleBuildStatus(msg.build);
      };
    })(this));
  };

  AppBuild.prototype.handleBuildStatus = function(build) {
    this.build = build;
    if (this.build == null) {
      this.button.style.background = "hsl(160,50%,50%)";
      this.button.innerHTML = '<i class="fa fa-wrench"></i> ' + this.app.translator.get("Build");
      if (this.interval != null) {
        clearInterval(this.interval);
        return this.interval = null;
      }
    } else if (this.build.progress < 100) {
      this.setBuildProgress(this.build.status_text, this.build.progress);
      if (this.interval == null) {
        return this.interval = setInterval(((function(_this) {
          return function() {
            return _this.updateBuildStatus();
          };
        })(this)), 1000);
      }
    } else {
      this.button.style.background = "hsl(200,50%,50%)";
      return this.button.innerHTML = '<i class="fa fa-download"></i> ' + this.app.translator.get("Download");
    }
  };

  AppBuild.prototype.setBuildProgress = function(text, progress) {
    this.button.style.background = "linear-gradient(90deg,hsl(30,50%,50%) 0%,hsl(30,50%,50%) " + progress + "%,rgba(255,255,255,.1) " + progress + "%)";
    return this.button.innerHTML = '<i class="fa fa-sync-alt"></i> ' + text;
  };

  return AppBuild;

})();

this.Explore = class Explore {
  constructor(app) {
    var likes;
    this.app = app;
    window.DOMPurify = DOMPurify(window);
    window.DOMPurify.setConfig({
      FORBID_TAGS: ['form', 'input', 'button', 'select', 'textarea'],
      FORBID_ATTR: ['formaction', 'target']
    });
    this.get("explore-back-button").addEventListener("click", () => {
      this.closeDetails();
      return this.app.appui.setMainSection("explore", true);
    });
    this.sort = "hot";
    this.active_tags = [];
    this.search = "";
    this.tags = [];
    this.visited_projects = {};
    this.sort_types = ["hot", "new", "top"];
    this.project_types = ["all", "app", "library", "plugin", "tutorial", "example", "template"];
    this.project_type = "all";
    this.sort_functions = {
      hot: function(a, b) {
        return b.likes - a.likes + b.date_published / (1000 * 3600 * 24) - a.date_published / (1000 * 3600 * 24);
      },
      top: function(a, b) {
        return b.likes - a.likes;
      },
      new: function(a, b) {
        return b.date_published - a.date_published;
      }
    };
    document.getElementById("explore-sort-button").addEventListener("click", () => {
      var e, j, len, ref, s;
      s = this.sort_types.indexOf(this.sort);
      s = (s + 1) % this.sort_types.length;
      this.sort = this.sort_types[s];
      e = document.getElementById("explore-sort-button");
      ref = this.sort_types;
      for (j = 0, len = ref.length; j < len; j++) {
        s = ref[j];
        if (s === this.sort) {
          e.classList.add(s);
        } else {
          e.classList.remove(s);
        }
      }
      document.querySelector("#explore-sort-button span").innerText = this.app.translator.get(this.sort.substring(0, 1).toUpperCase() + this.sort.substring(1));
      return this.query();
    });
    document.getElementById("explore-type-button").addEventListener("click", () => {
      var s;
      s = this.project_types.indexOf(this.project_type);
      s = (s + 1) % this.project_types.length;
      this.setProjectType(this.project_types[s]);
      return this.query();
    });
    document.getElementById("explore-search-input").addEventListener("input", () => {
      this.search = document.getElementById("explore-search-input").value;
      if (this.search_timeout != null) {
        clearTimeout(this.search_timeout);
      }
      return this.search_timeout = setTimeout((() => {
        return this.query();
      }), 1500);
    });
    document.getElementById("explore-contents").addEventListener("scroll", () => {
      var contents, h1, h2, pos, scrollzone;
      contents = document.getElementById("explore-box-list");
      scrollzone = document.getElementById("explore-contents");
      h1 = contents.getBoundingClientRect().height;
      h2 = scrollzone.getBoundingClientRect().height;
      if (scrollzone.scrollTop > h1 - h2 - 100) { //contents.getBoundingClientRect().height < scrollzone.scrollTop+window.innerHeight*2
        if (!this.completed) {
          pos = this.projects.length;
          if (pos !== this.query_position) {
            this.query(pos);
          }
        }
      }
    });
    this.cloned = {};
    this.get("project-details-clonebutton").addEventListener("click", () => {
      if (this.app.user == null) {
        return alert(this.app.translator.get("Log in or create your account to clone this project."));
      }
      this.get("project-details-clonebutton").style.display = "none";
      this.cloned[this.project.id] = true;
      return this.app.client.sendRequest({
        name: "clone_public_project",
        project: this.project.id
      }, (msg) => {
        this.app.appui.setMainSection("projects");
        this.app.appui.backToProjectList();
        this.app.updateProjectList(msg.id);
        return this.app.appui.showNotification(this.app.translator.get("Project cloned! Here is your copy."));
      });
    });
    likes = this.get("project-details-likes");
    likes.addEventListener("click", () => {
      if (!this.app.user.flags.validated) {
        return alert(this.app.translator.get("Validate your e-mail address to enable votes."));
      }
      if (this.project != null) {
        return this.app.client.sendRequest({
          name: "toggle_like",
          project: this.project.id
        }, (msg) => {
          if (msg.name === "project_likes") {
            likes.innerHTML = "<i class='fa fa-thumbs-up'></i> " + msg.likes;
            if (msg.liked) {
              return likes.classList.add("voted");
            } else {
              return likes.classList.remove("voted");
            }
          }
        });
      }
    });
    document.querySelector("#explore-tags-bar i").addEventListener("click", () => {
      var bar, icon;
      bar = document.querySelector("#explore-tags-bar");
      icon = bar.querySelector("i");
      if (bar.classList.contains("collapsed")) {
        bar.classList.remove("collapsed");
        icon.classList.remove("fa-caret-right");
        return icon.classList.add("fa-caret-down");
      } else {
        bar.classList.add("collapsed");
        icon.classList.add("fa-caret-right");
        return icon.classList.remove("fa-caret-down");
      }
    });
  }

  setProjectType(project_type) {
    var e, j, len, ref, s;
    this.project_type = project_type;
    e = document.getElementById("explore-type-button");
    ref = this.project_types;
    for (j = 0, len = ref.length; j < len; j++) {
      s = ref[j];
      if (s === this.project_type) {
        e.classList.add(s);
      } else {
        e.classList.remove(s);
      }
    }
    return document.querySelector("#explore-type-button span").innerText = this.app.translator.get(this.project_type.substring(0, 1).toUpperCase() + this.project_type.substring(1));
  }

  closeDetails() {
    return this.closeProject();
  }

  //@app.setHomeState()
  closed() {
    if (!document.title.startsWith("microStudio")) {
      return document.title = "microStudio";
    }
  }

  findBestTag(p) {
    var index, j, len, ref, score, t, tag;
    tag = p.tags[0];
    score = this.tags.indexOf(tag);
    if (score < 0) {
      score = 1000;
    }
    ref = p.tags;
    for (j = 0, len = ref.length; j < len; j++) {
      t = ref[j];
      index = this.tags.indexOf(t);
      if (index >= 0 && index < score) {
        score = index;
        tag = t;
      }
    }
    return tag;
  }

  createProjectBox(p) {
    var author, awaiting, element, icon, infobox, label, likes, runbutton, smallicon, tag, title;
    element = document.createElement("div");
    element.classList.add("explore-project-box");
    if (p.tags.length > 0) {
      tag = document.createElement("div");
      tag.innerText = this.findBestTag(p);
      tag.classList.add("project-tag");
      element.appendChild(tag);
    }
    if (p.poster) {
      icon = new Image;
      icon.src = location.origin + `/${p.owner}/${p.slug}/poster.png`;
      icon.classList.add("poster");
      //icon.classList.add "pixelated"
      icon.alt = p.title;
      icon.title = p.title;
      element.appendChild(icon);
      smallicon = new Image;
      smallicon.src = location.origin + `/${p.owner}/${p.slug}/icon.png`;
      smallicon.classList.add("smallicon");
      smallicon.classList.add("pixelated");
      smallicon.alt = p.title;
      smallicon.title = p.title;
      element.appendChild(smallicon);
    } else {
      icon = new Image;
      if (p.icon || p.type !== "example") {
        icon.src = location.origin + `/${p.owner}/${p.slug}/icon.png`;
      } else {
        icon.src = `${dev_domain}/img/lightbulb16.png`;
      }
      icon.classList.add("icon");
      icon.classList.add("pixelated");
      icon.alt = p.title;
      icon.title = p.title;
      element.appendChild(icon);
    }
    element.style.opacity = 0;
    element.style["transition-duration"] = "1s";
    element.style["transition-property"] = "opacity";
    icon.onload = () => {
      return element.style.opacity = 1;
    };
    infobox = document.createElement("div");
    infobox.classList.add("explore-infobox");
    element.appendChild(infobox);
    title = document.createElement("div");
    title.classList.add("explore-project-title");
    title.innerText = p.title;
    infobox.appendChild(title);
    author = this.app.appui.createUserTag(p.owner, p.owner_info.tier, p.owner_info.profile_image);
    infobox.appendChild(author);
    likes = document.createElement("div");
    likes.classList.add("explore-project-likes");
    likes.innerHTML = "<i class='fa fa-thumbs-up'></i> " + p.likes;
    if (p.liked) {
      likes.classList.add("voted");
    }
    infobox.appendChild(likes);
    runbutton = document.createElement("div");
    runbutton.classList.add("run-button");
    runbutton.innerHTML = "<i class='fa fa-play'></i> " + this.app.translator.get("Run");
    element.appendChild(runbutton);
    likes.addEventListener("click", (event) => {
      event.stopImmediatePropagation();
      if (!this.app.user.flags.validated) {
        return alert(this.app.translator.get("Validate your e-mail address to enable votes."));
      }
      return this.app.client.sendRequest({
        name: "toggle_like",
        project: p.id
      }, (msg) => {
        if (msg.name === "project_likes") {
          likes.innerHTML = "<i class='fa fa-thumbs-up'></i> " + msg.likes;
          p.likes = msg.likes;
          if (msg.liked) {
            likes.classList.add("voted");
            return p.liked = true;
          } else {
            p.liked = false;
            return likes.classList.remove("voted");
          }
        }
      });
    });
    if (p.type !== "app") {
      label = document.createElement("div");
      label.classList.add("type-label");
      label.classList.add(p.type);
      switch (p.type) {
        case "library":
          label.innerHTML = `<i class="fas fa-file-code"></i> ${this.app.translator.get("Library")}`;
          break;
        case "plugin":
          label.innerHTML = `<i class="fas fa-plug"></i> ${this.app.translator.get("Plug-in")}`;
          break;
        case "tutorial":
          label.innerHTML = `<i class="fas fa-graduation-cap"></i> ${this.app.translator.get("Tutorial")}`;
          break;
        case "example":
          label.innerHTML = `<i class="fas fa-lightbulb"></i> ${this.app.translator.get("Example")}`;
          break;
        case "template":
          label.innerHTML = `<i class="fas fa-boxes"></i> ${this.app.translator.get("Template")}`;
      }
      element.appendChild(label);
    }
    if (!p.flags.approved && !p.owner_info.approved && window.ms_project_moderation) {
      awaiting = document.createElement("div");
      awaiting.classList.add("awaiting-label");
      awaiting.innerHTML = "Awaiting approval";
      element.appendChild(awaiting);
    }
    runbutton.addEventListener("click", (event) => {
      event.stopPropagation();
      if (p.type === "tutorial") {
        return window.open(location.origin.replace(".dev", ".io") + `/tutorial/${p.owner}/${p.slug}/`, "_blank");
      } else {
        return window.open(location.origin.replace(".dev", ".io") + `/${p.owner}/${p.slug}/`, "_blank");
      }
    });
    element.addEventListener("click", () => {
      if (screen.width <= 700) {
        return window.open(location.origin.replace(".dev", ".io") + `/${p.owner}/${p.slug}/`, "_blank");
      } else {
        this.app.app_state.pushState("project_details", `/i/${p.owner}/${p.slug}/`, {
          project: p
        });
        this.openProject(p);
        return this.canBack = true;
      }
    });
    return element;
  }

  get(id) {
    return document.getElementById(id);
  }

  findProject(owner, slug) {
    var id, j, len, p, ref;
    id = `${owner}.${slug}`;
    if (this.visited_projects[id] != null) {
      return this.visited_projects[id];
    }
    if (this.projects != null) {
      ref = this.projects;
      for (j = 0, len = ref.length; j < len; j++) {
        p = ref[j];
        if (p.owner === owner && p.slug === slug) {
          return p;
        }
      }
    }
    return null;
  }

  openProject(p) {
    var desc, div, j, k, len, len1, lib, likes, list, ref, ref1, t;
    this.visited_projects[`${p.owner}.${p.slug}`] = p;
    this.project = p;
    if (this.cloned[this.project.id]) {
      this.get("project-details-clonebutton").style.display = "none";
    } else {
      this.get("project-details-clonebutton").style.display = "inline-block";
    }
    document.title = this.app.translator.get("%PROJECT% - by %USER%").replace("%PROJECT%", p.title).replace("%USER%", p.owner);
    this.get("explore-back-button").style.display = "inline-block";
    this.get("explore-tools").style.display = "none";
    this.get("explore-tags-bar").style.display = "none";
    this.get("explore-contents").style.display = "none";
    this.get("explore-project-details").style.display = "block";
    this.get("project-details-image").src = p.icon || p.type !== "example" ? location.origin + `/${p.owner}/${p.slug}/icon.png` : `${dev_domain}/img/lightbulb16.png`;
    this.get("project-details-title").innerText = p.title;
    desc = DOMPurify.sanitize(marked(p.description));
    if (p.poster) {
      this.get("project-details-info").style.background = `linear-gradient(to bottom, hsla(200,10%,10%,0.8), hsla(200,10%,10%,0.9)),url(/${p.owner}/${p.slug}/poster.png)`;
      this.get("project-details-info").style["background-size"] = "100%";
      this.get("project-details-info").style["background-repeat"] = "no-repeat";
    } else {
      this.get("project-details-info").style.background = "none";
    }
    desc += `<p style="margin-bottom: 5px; font-size: 14px; color: rgba(255,255,255,.5)"><i class="fas fa-calendar-alt" style="color:hsl(160,50%,40%)"></i>${this.app.translator.get("First published on %DATE%").replace("%DATE%", new Date(p.date_published).toLocaleDateString())}</p>`;
    desc += `<p style="margin-bottom: 5px; font-size: 14px; color: rgba(255,255,255,.5)"><i class="fas fa-calendar-alt" style="color:hsl(160,50%,40%)"></i>${this.app.translator.get("Last modified on %DATE%").replace("%DATE%", new Date(p.last_modified).toLocaleDateString())}</p>`;
    ref = p.libs;
    for (j = 0, len = ref.length; j < len; j++) {
      lib = ref[j];
      desc = `<p><i class="fas fa-info-circle" style="color:hsl(20,100%,70%)"></i>${this.app.translator.get("This project uses this optional library:")} ${lib}</p>` + desc;
    }
    if (p.graphics !== "M1") {
      desc = `<p><i class="fas fa-info-circle" style="color:hsl(20,100%,70%)"></i>${this.app.translator.get("This project uses this graphics API:")} ${p.graphics}</p>` + desc;
    }
    if (p.language != null) {
      desc = `<br /><div class="explore-project-language ${(p.language.split("_")[0])}">${(p.language.split("_")[0])}</div><br />` + desc;
    }
    this.get("project-details-description").innerHTML = desc;
    document.querySelector("#project-details-author").innerHTML = "";
    document.querySelector("#project-details-author").appendChild(this.app.appui.createUserTag(p.owner, p.owner_info.tier, p.owner_info.profile_image, 12));
    likes = this.get("project-details-likes");
    likes.innerHTML = "<i class='fa fa-thumbs-up'></i> " + p.likes;
    if (p.liked) {
      likes.classList.add("voted");
    } else {
      likes.classList.remove("voted");
    }
    if (p.type === "tutorial") {
      this.get("project-details-runbutton").href = location.origin.replace(".dev", ".io") + `/tutorial/${p.owner}/${p.slug}/`;
    } else if (p.type === "example") {
      this.get("project-details-runbutton").href = `${dev_domain}/tutorials/examples/${p.owner}/${p.slug}/`;
    } else {
      this.get("project-details-runbutton").href = location.origin.replace(".dev", ".io") + `/${p.owner}/${p.slug}/`;
    }
    list = this.get("project-details-tags");
    list.innerHTML = "";
    ref1 = p.tags;
    for (k = 0, len1 = ref1.length; k < len1; k++) {
      t = ref1[k];
      div = document.createElement("div");
      div.classList.add("tag");
      div.innerText = t;
      list.appendChild(div);
      if ((this.app.user != null) && this.app.user.flags.admin) {
        ((t) => {
          return div.addEventListener("click", () => {
            var index;
            if (confirm("really delete tag?")) {
              index = p.tags.indexOf(t);
              if (index >= 0) {
                p.tags.splice(index, 1);
                return this.app.client.sendRequest({
                  name: "set_project_tags",
                  project: p.id,
                  tags: p.tags
                }, (msg) => {
                  return this.openProject(p);
                });
              }
            }
          });
        })(t);
      }
    }
    if ((this.app.user != null) && (this.app.user.flags.admin || this.app.user.flags.moderator) && window.ms_project_moderation) {
      if (p.owner_info.approved) {
        document.getElementById("project-details-description").appendChild(this.createModerationParagraph("User approved, project visible to everyone"));
        document.getElementById("project-details-description").appendChild(this.createModerationButton("Remove user approval", () => {
          if (confirm("Really remove user approval?")) {
            return this.app.client.sendRequest({
              name: "set_user_approved",
              user: p.owner,
              approved: false
            }, (msg) => {
              return location.reload();
            });
          }
        }));
      } else if (p.flags.approved) {
        document.getElementById("project-details-description").appendChild(this.createModerationParagraph("Project is approved and visible to everyone"));
        document.getElementById("project-details-description").appendChild(this.createModerationButton("Remove project approval", () => {
          if (confirm("Really remove project approval?")) {
            return this.app.client.sendRequest({
              name: "set_project_approved",
              project: p.id,
              approved: false
            }, (msg) => {
              return location.reload();
            });
          }
        }));
      } else {
        document.getElementById("project-details-description").appendChild(this.createModerationParagraph("Project is visible only to moderators, awaiting approval"));
        document.getElementById("project-details-description").appendChild(this.createModerationButton("Approve project", () => {
          if (confirm("Really approve project?")) {
            return this.app.client.sendRequest({
              name: "set_project_approved",
              project: p.id,
              approved: true
            }, (msg) => {
              return location.reload();
            });
          }
        }));
        document.getElementById("project-details-description").appendChild(this.createModerationButton("Approve user", () => {
          if (confirm("Really approve user?")) {
            return this.app.client.sendRequest({
              name: "set_user_approved",
              user: p.owner,
              approved: true
            }, (msg) => {
              return location.reload();
            });
          }
        }));
      }
      div = document.createElement("div");
      div.classList.add("tag");
      div.innerText = "+ add";
      div.style = "background: hsl(0,50%,50%)";
      list.appendChild(div);
      div.addEventListener("click", () => {
        var value;
        value = prompt("add tag");
        if ((value != null) && value.length > 1) {
          p.tags.push(value);
          return this.app.client.sendRequest({
            name: "set_project_tags",
            project: p.id,
            tags: p.tags
          }, (msg) => {
            return this.openProject(p);
          });
        }
      });
    }
    if (this.details == null) {
      this.details = new ProjectDetails(this.app);
    }
    return this.details.set(p);
  }

  createModerationParagraph(text) {
    var p;
    p = document.createElement("p");
    p.style = "padding: 25px 0px 5px 0";
    p.innerHTML = text;
    return p;
  }

  createModerationButton(text, callback) {
    var div;
    div = document.createElement("div");
    div.style = "padding: 5px 10px ; margin-left: 10px ; background:hsl(20,50%,50%) ; cursor: pointer; display: inline-block; border-radius: 5px";
    div.innerHTML = text;
    div.addEventListener("click", () => {
      return callback();
    });
    return div;
  }

  closeProject(p) {
    this.get("explore-back-button").style.display = "none";
    this.get("explore-tools").style.display = "inline-block";
    this.get("explore-tags-bar").style.display = "block";
    this.get("explore-contents").style.display = "block";
    this.get("explore-project-details").style.display = "none";
    this.project = null;
    return this.closed();
  }

  createTags(tags) {
    var div, j, len, ref, t;
    this.tags = tags;
    document.getElementById("explore-tags").innerHTML = "";
    ref = this.tags;
    for (j = 0, len = ref.length; j < len; j++) {
      t = ref[j];
      div = document.createElement("div");
      div.innerText = t;
      if (this.active_tags.includes(t)) {
        div.classList.add("active");
      }
      //span = document.createElement "span"
      //span.innerText = t.count
      //div.appendChild span
      document.getElementById("explore-tags").appendChild(div);
      ((t, div) => {
        return div.addEventListener("click", () => {
          var index;
          index = this.active_tags.indexOf(t);
          if (index >= 0) {
            this.active_tags.splice(index, 1);
            div.classList.remove("active");
          } else {
            this.active_tags.push(t);
            div.classList.add("active");
          }
          return this.query();
        });
      })(t, div);
    }
  }

  loadProjects(pos = 0) {
    var contents, i, j, mod, p, ref, ref1, scrollzone;
    if (this.projects == null) {
      return;
    }
    contents = document.getElementById("explore-box-list");
    scrollzone = document.getElementById("explore-contents");
    if (pos === 0) {
      contents.innerHTML = "";
    }
    mod = (this.app.user != null) && (this.app.user.flags.admin || this.app.user.flags.moderator);
    for (i = j = ref = pos, ref1 = this.projects.length - 1; j <= ref1; i = j += 1) {
      p = this.projects[i];
      if (mod || (p.flags.approved || p.owner_info.approved || !window.ms_project_moderation)) {
        contents.appendChild(this.createProjectBox(p));
      }
    }
  }

  update() {
    var owner, project;
    if (!this.initialized && location.pathname.startsWith("/i/")) {
      document.getElementById("explore-section").style.opacity = 0;
    }
    if (!this.initialized && location.pathname.startsWith("/i/")) {
      this.initialized = true;
      owner = location.pathname.split("/")[2];
      project = location.pathname.split("/")[3];
      return this.app.client.sendRequest({
        name: "get_public_project",
        owner: owner,
        project: project
      }, (msg) => {
        project = msg.project;
        if (project != null) {
          this.openProject(project);
          document.getElementById("explore-section").style.opacity = 1;
        }
      });
    } else {
      if ((this.projects == null) || this.projects.length === 0) {
        return this.query();
      }
    }
  }

  query(position = 0) {
    var f;
    this.query_position = position;
    if (position === 0 || (this.current_offset == null)) {
      this.current_offset = 0;
    }
    f = () => {};
    this.app.client.sendRequest({
      name: "get_public_projects",
      ranking: this.sort,
      type: this.project_type,
      tags: this.active_tags,
      search: this.search.toLowerCase(),
      position: position,
      offset: this.current_offset
    }, (msg) => {
      var pos;
      if (position === 0) {
        this.current_position = position;
        this.current_offset = msg.offset;
        this.completed = false;
        this.projects = msg.list;
        this.createTags(msg.tags);
        this.loadProjects();
        document.getElementById("explore-contents").scrollTop = 0;
      } else {
        if (msg.list.length === 0) {
          this.completed = true;
        }
        this.current_position = position;
        this.current_offset = msg.offset;
        pos = this.projects.length;
        this.projects = this.projects.concat(msg.list);
        this.loadProjects(pos);
      }
      if (!this.initialized) {
        this.initialized = true;
        return document.getElementById("explore-section").style.opacity = 1;
      }
    });
  }

};

//@app.setHomeState()

this.ProjectDetails = class ProjectDetails {
  constructor(app) {
    var j, len, ref, s;
    this.app = app;
    this.menu = ["code", "sprites", "sounds", "music", "assets", "doc"];
    ref = this.menu;
    for (j = 0, len = ref.length; j < len; j++) {
      s = ref[j];
      ((s) => {
        return document.getElementById(`project-contents-menu-${s}`).addEventListener("click", () => {
          return this.setSection(s);
        });
      })(s);
    }
    this.splitbar = new SplitBar("explore-project-details", "horizontal");
    this.splitbar.setPosition(45);
    this.editor = ace.edit("project-contents-view-editor");
    this.editor.$blockScrolling = 2e308;
    this.editor.setTheme("ace/theme/tomorrow_night_bright");
    this.editor.getSession().setMode("ace/mode/microscript");
    this.editor.setReadOnly(true);
    this.editor.getSession().setOptions({
      tabSize: 2,
      useSoftTabs: true,
      useWorker: false // disables lua autocorrection ; preserves syntax coloring
    });
    document.querySelector("#project-contents-source-import").addEventListener("click", () => {
      var count, file, name;
      if (this.app.project == null) {
        return;
      }
      file = this.selected_source;
      if (file == null) {
        return;
      }
      if (this.imported_sources[file]) {
        return;
      }
      this.imported_sources[file] = true;
      name = file.split(".")[0];
      count = 1;
      while (this.app.project.getSource(name) != null) {
        count += 1;
        name = file.split(".")[0] + count;
      }
      file = name + ".ms";
      return this.app.client.sendRequest({
        name: "write_project_file",
        project: this.app.project.id,
        file: `ms/${file}`,
        content: this.sources[this.selected_source]
      }, (msg) => {
        this.app.project.updateSourceList();
        return this.setSelectedSource(this.selected_source);
      });
    });
    document.getElementById("project-contents-sprite-import").addEventListener("click", () => {
      var base, count, data, name;
      if (this.app.project == null) {
        return;
      }
      if (this.selected_sprite == null) {
        return;
      }
      name = this.selected_sprite.name;
      if (name == null) {
        return;
      }
      if (this.imported_sprites[name]) {
        return;
      }
      this.imported_sprites[name] = true;
      document.getElementById("project-contents-sprite-import").style.display = "none";
      count = 1;
      base = name;
      while (this.app.project.getSprite(name) != null) {
        count += 1;
        name = base + count;
      }
      data = this.selected_sprite.saveData().split(",")[1];
      return this.app.client.sendRequest({
        name: "write_project_file",
        project: this.app.project.id,
        file: `sprites/${name}.png`,
        properties: {
          frames: this.selected_sprite.frames.length,
          fps: this.selected_sprite.fps
        },
        content: data
      }, (msg) => {
        return this.app.project.updateSpriteList();
      });
    });
    document.querySelector("#project-contents-doc-import").addEventListener("click", () => {
      var value;
      if (this.app.project == null) {
        return;
      }
      if (this.imported_doc || (this.doc == null)) {
        return;
      }
      this.imported_doc = true;
      value = this.app.doc_editor.editor.getValue();
      if ((value != null) && value.length > 0) {
        value = value + "\n\n" + this.doc;
      } else {
        value = this.doc;
      }
      return this.app.client.sendRequest({
        name: "write_project_file",
        project: this.app.project.id,
        file: "doc/doc.md",
        content: value
      }, (msg) => {
        this.app.project.loadDoc();
        document.querySelector("#project-contents-doc-import").classList.add("done");
        document.querySelector("#project-contents-doc-import i").classList.add("fa-check");
        document.querySelector("#project-contents-doc-import i").classList.remove("fa-download");
        return document.querySelector("#project-contents-doc-import span").innerText = this.app.translator.get("Doc imported");
      });
    });
    document.getElementById("post-project-comment-button").addEventListener("click", () => {
      var text;
      text = document.querySelector("#post-project-comment textarea").value;
      if ((text != null) && text.length > 0) {
        this.postComment(text);
        return document.querySelector("#post-project-comment textarea").value = "";
      }
    });
    document.getElementById("login-to-post-comment").addEventListener("click", () => {
      return this.app.appui.showLoginPanel();
    });
    document.getElementById("validate-to-post-comment").addEventListener("click", () => {
      return this.app.appui.setMainSection("usersettings");
    });
  }

  set(project1) {
    var a, j, len, ref, ref1, section, t;
    this.project = project1;
    this.splitbar.update();
    this.sources = [];
    this.sprites = [];
    this.sounds = [];
    this.music = [];
    this.maps = [];
    this.imported_sources = {};
    this.imported_sprites = {};
    this.imported_doc = false;
    document.querySelector("#project-contents-doc-import").classList.remove("done");
    document.querySelector("#project-contents-doc-import").style.display = this.app.project != null ? "block" : "none";
    document.querySelector("#project-contents-source-import").style.display = (this.app.project != null) && this.app.project.id !== this.project.id ? "block" : "none";
    if (this.app.project != null) {
      document.querySelector("#project-contents-doc-import span").innerText = this.app.translator.get("Import doc to") + " " + this.app.project.title;
    }
    document.querySelector("#project-contents-view .code-list").innerHTML = "";
    document.querySelector("#project-contents-view .sprite-list").innerHTML = "";
    document.querySelector("#project-contents-view .sound-list").innerHTML = "";
    document.querySelector("#project-contents-view .music-list").innerHTML = "";
    document.querySelector("#project-contents-view .asset-list").innerHTML = "";
    //document.querySelector("#project-contents-view .maps").innerHTML = ""
    document.querySelector("#project-contents-view .doc-render").innerHTML = "";
    section = "code";
    ref = this.project.tags;
    for (j = 0, len = ref.length; j < len; j++) {
      t = ref[j];
      if (t.indexOf("sprite") >= 0) {
        section = "sprites";
      } else if (t.indexOf("tutorial") >= 0 || t.indexOf("tutoriel") >= 0) {
        section = "doc";
      }
    }
    if ((ref1 = this.project.type) === "tutorial" || ref1 === "library") {
      section = "doc";
    }
    this.setSection(section);
    this.sources = {};
    this.selected_source = null;
    this.app.client.sendRequest({
      name: "list_public_project_files",
      project: this.project.id,
      folder: "ms"
    }, (msg) => {
      return this.setSourceList(msg.files);
    });
    this.app.client.sendRequest({
      name: "list_public_project_files",
      project: this.project.id,
      folder: "sprites"
    }, (msg) => {
      return this.setSpriteList(msg.files);
    });
    this.app.client.sendRequest({
      name: "list_public_project_files",
      project: this.project.id,
      folder: "sounds"
    }, (msg) => {
      return this.setSoundList(msg.files);
    });
    this.app.client.sendRequest({
      name: "list_public_project_files",
      project: this.project.id,
      folder: "music"
    }, (msg) => {
      return this.setMusicList(msg.files);
    });
    this.app.client.sendRequest({
      name: "list_public_project_files",
      project: this.project.id,
      folder: "assets"
    }, (msg) => {
      return this.setAssetList(msg.files);
    });
    //@app.client.sendRequest {
    //  name: "list_public_project_files"
    //  project: @project.id
    //  folder: "maps"
    //},(msg)=>
    //  @setMapList msg.files
    this.app.client.sendRequest({
      name: "list_public_project_files",
      project: this.project.id,
      folder: "doc"
    }, (msg) => {
      return this.setDocList(msg.files);
    });
    this.updateComments();
    this.updateCredentials();
    a = document.querySelector("#project-contents-view .sprites .export-panel a");
    a.href = `/${this.project.owner}/${this.project.slug}/export/sprites/`;
    a.download = `${this.project.slug}_sprites.zip`;
    a = document.querySelector("#project-details-exportbutton");
    a.href = `/${this.project.owner}/${this.project.slug}/export/project/`;
    return a.download = `${this.project.slug}_files.zip`;
  }

  updateCredentials() {
    if (this.app.user != null) {
      document.getElementById("login-to-post-comment").style.display = "none";
      if (this.app.user.flags.validated) {
        document.getElementById("validate-to-post-comment").style.display = "none";
        return document.getElementById("post-project-comment").style.display = "block";
      } else {
        document.getElementById("validate-to-post-comment").style.display = "inline-block";
        return document.getElementById("post-project-comment").style.display = "none";
      }
    } else {
      document.getElementById("login-to-post-comment").style.display = "inline-block";
      document.getElementById("validate-to-post-comment").style.display = "none";
      return document.getElementById("post-project-comment").style.display = "none";
    }
  }

  loadFile(url, callback) {
    var req;
    req = new XMLHttpRequest();
    req.onreadystatechange = (event) => {
      if (req.readyState === XMLHttpRequest.DONE) {
        if (req.status === 200) {
          return callback(req.responseText);
        }
      }
    };
    req.open("GET", url);
    return req.send();
  }

  setSection(section) {
    var j, len, ref, s;
    ref = this.menu;
    for (j = 0, len = ref.length; j < len; j++) {
      s = ref[j];
      if (s === section) {
        document.getElementById(`project-contents-menu-${s}`).classList.add("selected");
        document.querySelector(`#project-contents-view .${s}`).style.display = "block";
      } else {
        document.getElementById(`project-contents-menu-${s}`).classList.remove("selected");
        document.querySelector(`#project-contents-view .${s}`).style.display = "none";
      }
    }
  }

  createSourceEntry(file) {
    return this.app.client.sendRequest({
      name: "read_public_project_file",
      project: this.project.id,
      file: `ms/${file}`
    }, (msg) => {
      var div;
      this.sources[file] = msg.content;
      div = document.createElement("div");
      div.innerHTML = `<i class='fa fa-file-code'></i> ${(file.split(".")[0])}`;
      document.querySelector("#project-contents-view .code-list").appendChild(div);
      div.id = `project-contents-view-source-${file}`;
      div.addEventListener("click", () => {
        return this.setSelectedSource(file);
      });
      if (this.selected_source == null) {
        return this.setSelectedSource(file);
      }
    });
  }

  setSelectedSource(file) {
    var lang, source;
    this.selected_source = file;
    this.source_folder.setSelectedItem(file);
    source = this.project_sources[file];
    if ((source != null) && (source.parent != null)) {
      source.parent.setOpen(true);
    }
    if ((this.project != null) && (this.project.language != null)) {
      lang = this.project.language;
      if (lang === "microscript_v2" && (this.sources[file] != null) && /^\s*\/\/\s*javascript\s*\n/.test(this.sources[file])) {
        lang = "javascript";
      }
      lang = this.app.languages[lang] || this.app.languages["microscript2"];
      this.editor.getSession().setMode(lang.ace_mode);
    }
    this.editor.setValue(this.sources[file], -1);
    if (this.app.project == null) {
      return;
    }
    if (this.imported_sources[file]) {
      document.querySelector("#project-contents-source-import").classList.add("done");
      document.querySelector("#project-contents-source-import i").classList.remove("fa-download");
      document.querySelector("#project-contents-source-import i").classList.add("fa-check");
      return document.querySelector("#project-contents-source-import span").innerText = this.app.translator.get("Source file imported");
    } else {
      document.querySelector("#project-contents-source-import").classList.remove("done");
      document.querySelector("#project-contents-source-import i").classList.add("fa-download");
      document.querySelector("#project-contents-source-import i").classList.remove("fa-check");
      return document.querySelector("#project-contents-source-import span").innerText = this.app.translator.get("Import source file to") + " " + this.app.project.title;
    }
  }

  setSourceList(files) {
    var f, folder, j, len, manager, project, s, table, view;
    // for f in files
    //   @createSourceEntry(f.file)
    // return
    table = {};
    manager = {
      folder: "ms",
      item: "source",
      openItem: (item) => {
        return this.setSelectedSource(item);
      }
    };
    // table[item].play()
    this.project_sources = {};
    project = JSON.parse(JSON.stringify(this.project)); // create a clone
    project.app = this.app;
    project.notifyListeners = (source) => {
      this.sources[source.name] = source.content;
      if (this.selected_source == null) {
        return this.setSelectedSource(source.name);
      }
    };
    project.getFullURL = function() {
      var url;
      return url = location.origin + `/${project.owner}/${project.slug}/`;
    };
    folder = new ProjectFolder(null, "source");
    for (j = 0, len = files.length; j < len; j++) {
      f = files[j];
      s = new ExploreProjectSource(project, f.file);
      this.project_sources[s.name] = s;
      folder.push(s);
      table[s.name] = s;
    }
    view = new FolderView(manager, document.querySelector("#project-contents-view .code-list"));
    this.source_folder = view;
    view.editable = false;
    view.rebuildList(folder);
  }

  setSpriteList(files) {
    var f, folder, j, len, manager, project, s, table;
    table = {};
    this.sprites = {};
    manager = {
      folder: "sprites",
      item: "sprite",
      openItem: (item) => {
        this.sprites_folder_view.setSelectedItem(item);
        this.selected_sprite = this.sprites[item];
        if ((this.app.project != null) && !this.imported_sprites[item]) {
          document.querySelector("#project-contents-sprite-import span").innerText = this.app.translator.get("Import %ITEM% to project %PROJECT%").replace("%ITEM%", item.replace(/-/g, "/")).replace("%PROJECT%", this.app.project.title);
          return document.getElementById("project-contents-sprite-import").style.display = "block";
        } else {
          return document.getElementById("project-contents-sprite-import").style.display = "none";
        }
      }
    };
    project = JSON.parse(JSON.stringify(this.project)); // create a clone
    project.getFullURL = function() {
      var url;
      return url = location.origin + `/${project.owner}/${project.slug}/`;
    };
    project.map_list = [];
    project.notifyListeners = function() {};
    folder = new ProjectFolder(null, "sprites");
    for (j = 0, len = files.length; j < len; j++) {
      f = files[j];
      s = new ProjectSprite(project, f.file, null, null, f.properties);
      folder.push(s);
      table[s.name] = s;
      this.sprites[s.name] = s;
    }
    this.sprites_folder_view = new FolderView(manager, document.querySelector("#project-contents-view .sprite-list"));
    this.sprites_folder_view.editable = false;
    this.sprites_folder_view.rebuildList(folder);
    document.getElementById("project-contents-sprite-import").style.display = "none";
  }

  setSoundList(files) {
    var f, folder, j, len, manager, project, s, table, view;
    if (files.length > 0) {
      document.getElementById("project-contents-menu-sounds").style.display = "block";
    } else {
      document.getElementById("project-contents-menu-sounds").style.display = "none";
    }
    table = {};
    manager = {
      folder: "sounds",
      item: "sound",
      openItem: function(item) {
        return table[item].play();
      }
    };
    project = JSON.parse(JSON.stringify(this.project)); // create a clone
    project.getFullURL = function() {
      var url;
      return url = location.origin + `/${project.owner}/${project.slug}/`;
    };
    folder = new ProjectFolder(null, "sounds");
    for (j = 0, len = files.length; j < len; j++) {
      f = files[j];
      s = new ProjectSound(project, f.file);
      folder.push(s);
      table[s.name] = s;
    }
    view = new FolderView(manager, document.querySelector("#project-contents-view .sound-list"));
    view.editable = false;
    view.rebuildList(folder);
  }

  setMusicList(files) {
    var f, folder, j, len, manager, project, s, table, view;
    if (files.length > 0) {
      document.getElementById("project-contents-menu-music").style.display = "block";
    } else {
      document.getElementById("project-contents-menu-music").style.display = "none";
    }
    table = {};
    manager = {
      folder: "music",
      item: "music",
      openItem: function(item) {
        return table[item].play();
      }
    };
    project = JSON.parse(JSON.stringify(this.project)); // create a clone
    project.getFullURL = () => {
      var url;
      return url = location.origin + `/${project.owner}/${project.slug}/`;
    };
    folder = new ProjectFolder(null, "sounds");
    for (j = 0, len = files.length; j < len; j++) {
      f = files[j];
      s = new ProjectMusic(project, f.file);
      folder.push(s);
      table[s.name] = s;
    }
    view = new FolderView(manager, document.querySelector("#project-contents-view .music-list"));
    view.editable = false;
    view.rebuildList(folder);
  }

  setAssetList(files) {
    var f, folder, j, len, manager, project, s, table, view;
    if (files.length > 0) {
      document.getElementById("project-contents-menu-assets").style.display = "block";
    } else {
      document.getElementById("project-contents-menu-assets").style.display = "none";
    }
    table = {};
    manager = {
      folder: "assets",
      item: "asset",
      openItem: function(item) {}
    };
    project = JSON.parse(JSON.stringify(this.project)); // create a clone
    project.getFullURL = function() {
      var url;
      return url = location.origin + `/${project.owner}/${project.slug}/`;
    };
    folder = new ProjectFolder(null, "assets");
    for (j = 0, len = files.length; j < len; j++) {
      f = files[j];
      s = new ProjectAsset(project, f.file);
      folder.push(s);
      table[s.name] = s;
    }
    view = new FolderView(manager, document.querySelector("#project-contents-view .asset-list"));
    view.editable = false;
    view.rebuildList(folder);
  }

  setMapList(files) {
    return console.info(files);
  }

  setDocList(files) {
    if (files.length > 0) {
      document.getElementById("project-contents-menu-doc").style.display = "block";
      return this.app.client.sendRequest({
        name: "read_public_project_file",
        project: this.project.id,
        file: `doc/${files[0].file}`
      }, (msg) => {
        this.doc = msg.content;
        if ((this.doc != null) && this.doc.trim().length > 0) {
          return document.querySelector("#project-contents-view .doc-render").innerHTML = DOMPurify.sanitize(marked(msg.content));
        } else {
          return document.getElementById("project-contents-menu-doc").style.display = "none";
        }
      });
    } else {
      return document.getElementById("project-contents-menu-doc").style.display = "none";
    }
  }

  //console.info files
  updateComments() {
    return this.app.client.sendRequest({
      name: "get_project_comments",
      project: this.project.id
    }, (msg) => {
      var c, e, j, len, ref;
      e = document.getElementById("project-comment-list");
      e.innerHTML = "";
      if (msg.comments != null) {
        ref = msg.comments;
        for (j = 0, len = ref.length; j < len; j++) {
          c = ref[j];
          this.createCommentBox(c);
        }
      }
    });
  }

  createCommentBox(c) {
    var author, buttons, clear, contents, div, i, span, t, time, tt;
    console.info(c);
    div = document.createElement("div");
    div.classList.add("comment");
    author = document.createElement("div");
    author.classList.add("author");
    i = document.createElement("i");
    i.classList.add("fa");
    i.classList.add("fa-user");
    span = document.createElement("span");
    span.innerText = c.user;
    author.appendChild(i);
    author.appendChild(span);
    author = this.app.appui.createUserTag(c.user, c.user_info.tier, c.user_info.profile_image, 12);
    time = document.createElement("div");
    time.classList.add("time");
    t = (Date.now() - c.time) / 60000;
    if (t < 2) {
      tt = this.app.translator.get("now");
    } else if (t < 120) {
      tt = this.app.translator.get("%NUM% minutes ago").replace("%NUM%", Math.round(t));
    } else {
      t /= 60;
      if (t < 48) {
        tt = this.app.translator.get("%NUM% hours ago").replace("%NUM%", Math.round(t));
      } else {
        t /= 24;
        if (t < 14) {
          tt = this.app.translator.get("%NUM% days ago").replace("%NUM%", Math.round(t));
        } else if (t < 30) {
          tt = this.app.translator.get("%NUM% weeks ago").replace("%NUM%", Math.round(t / 7));
        } else {
          tt = new Date(c.time).toLocaleDateString(this.app.translator.lang, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        }
      }
    }
    time.innerText = tt;
    div.appendChild(time);
    div.appendChild(author);
    if ((this.app.user != null) && (this.app.user.nick === c.user || this.app.user.flags.admin)) {
      buttons = document.createElement("div");
      buttons.classList.add("buttons");
      //buttons.appendChild @createButton "edit","Edit","green",()=>
      //  @editComment c
      //buttons.appendChild document.createElement "br"
      buttons.appendChild(this.createButton("trash", this.app.translator.get("Delete"), "red", () => {
        return this.deleteComment(c);
      }));
      div.appendChild(buttons);
    }
    contents = document.createElement("div");
    contents.classList.add("contents");
    contents.innerHTML = DOMPurify.sanitize(marked(c.text));
    div.appendChild(contents);
    clear = document.createElement("div");
    clear.style = "clear:both";
    div.appendChild(clear);
    return document.getElementById("project-comment-list").appendChild(div);
  }

  createButton(icon, text, color, callback) {
    var button, i, span;
    button = document.createElement("div");
    button.classList.add("small" + color + "button");
    i = document.createElement("i");
    i.classList.add("fa");
    i.classList.add(`fa-${icon}`);
    button.appendChild(i);
    span = document.createElement("span");
    span.innerText = text;
    button.appendChild(span);
    button.addEventListener("click", () => {
      return callback();
    });
    return button;
  }

  postComment(text) {
    return this.app.client.sendRequest({
      name: "add_project_comment",
      project: this.project.id,
      text: text
    }, (msg) => {
      return this.updateComments();
    });
  }

  editComment(id, text) {}

  deleteComment(c) {
    return ConfirmDialog.confirm(this.app.translator.get("Do you really want to delete this comment?"), this.app.translator.get("Delete"), this.app.translator.get("Cancel"), () => {
      return this.app.client.sendRequest({
        name: "delete_project_comment",
        project: this.project.id,
        id: c.id
      }, (msg) => {
        return this.updateComments();
      });
    });
  }

};

this.ExploreProjectSource = class ExploreProjectSource {
  constructor(project1, file1, size = 0) {
    var s;
    this.project = project1;
    this.file = file1;
    this.size = size;
    this.name = this.file.split(".")[0];
    this.ext = this.file.split(".")[1];
    this.filename = this.file;
    this.file = `ms/${this.file}`;
    s = this.name.split("-");
    this.shortname = s[s.length - 1];
    this.path_prefix = s.length > 1 ? s.splice(0, s.length - 1).join("-") + "-" : "";
    this.content = "";
    this.fetched = false;
    this.reload();
  }

  reload() {
    return fetch(this.project.getFullURL() + `ms/${this.name}.ms`).then((result) => {
      return result.text().then((text) => {
        this.content = text;
        this.fetched = true;
        return this.project.notifyListeners(this);
      });
    });
  }

};

this.UserSettings = class UserSettings {
  constructor(app) {
    var checkDeleteButton;
    this.app = app;
    document.getElementById("resend-validation-email").addEventListener("click", () => {
      return this.resendValidationEMail();
    });
    //document.getElementById("change-password").addEventListener "click",()=>@changePassword()
    document.getElementById("subscribe-newsletter").addEventListener("change", () => {
      return this.newsletterChange();
    });
    document.getElementById("experimental-features").addEventListener("change", () => {
      return this.experimentalChange();
    });
    document.getElementById("usersetting-email").addEventListener("input", () => {
      return this.emailChange();
    });
    document.getElementById("open-translation-app").addEventListener("click", () => {
      return this.openTranslationApp();
    });
    document.getElementById("translation-app-back-button").addEventListener("click", () => {
      return this.closeTranslationApp();
    });
    if (window.ms_standalone) {
      this.hideChangePassword();
    } else {
      document.getElementById("usersetting-change-password").addEventListener("click", () => {
        return this.changePasswordClick();
      });
      document.getElementById("usersetting-password-new2").addEventListener("keyup", (event) => {
        if (event.keyCode === 13) {
          return this.changePasswordClick();
        }
      });
      document.getElementById("show-account-deletion").addEventListener("click", () => {
        var e;
        e = document.getElementById("delete-account-form");
        if (e.style.display !== "block") {
          e.style.display = "block";
          return document.getElementById("delete-account").scrollIntoView();
        } else {
          return e.style.display = "none";
        }
      });
      document.getElementById("delete-account-button").addEventListener("click", () => {
        return this.deleteAccount();
      });
      checkDeleteButton = () => {
        if (document.getElementById("delete-account-confirm").value === "DELETE MY ACCOUNT" && document.getElementById("delete-account-password").value.length > 0) {
          return document.getElementById("delete-account-button").classList.add("enabled");
        } else {
          return document.getElementById("delete-account-button").classList.remove("enabled");
        }
      };
      document.getElementById("delete-account-confirm").addEventListener("keyup", checkDeleteButton);
      document.getElementById("delete-account-password").addEventListener("keyup", checkDeleteButton);
    }
    this.nick_validator = new InputValidator(document.getElementById("usersetting-nick"), document.getElementById("usersetting-nick-button"), document.getElementById("usersetting-nick-error"), (value) => {
      var nick;
      nick = value[0];
      return this.app.client.sendRequest({
        name: "change_nick",
        nick: nick
      }, (msg) => {
        if (msg.name === "error" && (msg.value != null)) {
          this.nick_validator.reset();
          return this.nick_validator.showError(this.app.translator.get(msg.value));
        } else {
          this.nick_validator.set(nick);
          this.app.user.nick = nick;
          document.getElementById("user-nick").innerText = nick;
          return this.nickUpdated();
        }
      });
    });
    this.nick_validator.regex = RegexLib.nick;
    this.email_validator = new InputValidator(document.getElementById("usersetting-email"), document.getElementById("usersetting-email-button"), document.getElementById("usersetting-email-error"), (value) => {
      var email;
      email = value[0];
      return this.app.client.sendRequest({
        name: "change_email",
        email: email
      }, (msg) => {
        if (msg.name === "error" && (msg.value != null)) {
          this.email_validator.reset();
          return this.email_validator.showError(this.app.translator.get(msg.value));
        } else {
          this.email_validator.set(email);
          return this.app.user.email = email;
        }
      });
    });
    this.email_validator.regex = RegexLib.email;
    this.sections = ["settings", "profile", "progress"];
    this.initSections();
    document.getElementById("usersettings-profile").addEventListener("dragover", (event) => {
      event.preventDefault();
      return document.querySelector("#usersettings-profile-image .fa-user-circle").classList.add("dragover");
    });
    //console.info event
    document.getElementById("usersettings-profile").addEventListener("dragleave", (event) => {
      event.preventDefault();
      return document.querySelector("#usersettings-profile-image .fa-user-circle").classList.remove("dragover");
    });
    //console.info event
    document.getElementById("usersettings-profile").addEventListener("drop", (event) => {
      var err, file, i, j, len, list, ref;
      event.preventDefault();
      document.querySelector("#usersettings-profile-image .fa-user-circle").classList.remove("dragover");
      try {
        list = [];
        ref = event.dataTransfer.items;
        for (j = 0, len = ref.length; j < len; j++) {
          i = ref[j];
          list.push(i.getAsFile());
        }
        if (list.length > 0) {
          file = list[0];
          return this.profileImageDropped(file);
        }
      } catch (error) {
        err = error;
        return console.error(err);
      }
    });
    document.querySelector("#usersettings-profile-image").addEventListener("click", () => {
      var input;
      input = document.createElement("input");
      input.type = "file";
      input.addEventListener("change", (event) => {
        var f, files;
        files = event.target.files;
        if (files.length >= 1) {
          f = files[0];
          return this.profileImageDropped(f);
        }
      });
      return input.click();
    });
    document.querySelector("#usersettings-profile .fa-times-circle").addEventListener("click", () => {
      return this.removeProfileImage();
    });
    document.getElementById("usersettings-profile-description").addEventListener("input", () => {
      return this.profileDescriptionChanged();
    });
    if (window.ms_standalone) {
      document.getElementById("usersettings-menu-profile").style.display = "none";
    }
  }

  initSections() {
    var j, len, ref, results, s;
    ref = this.sections;
    results = [];
    for (j = 0, len = ref.length; j < len; j++) {
      s = ref[j];
      results.push(((s) => {
        return document.getElementById(`usersettings-menu-${s}`).addEventListener("click", () => {
          switch (s) {
            case "settings":
              return this.app.openUserSettings();
            case "profile":
              return this.app.openUserProfile();
            case "progress":
              return this.app.openUserProgress();
          }
        });
      })(s));
    }
    return results;
  }

  isSectionAllowed(section) {
    if (this.app.user.flags.guest) {
      return section === "progress";
    } else if (window.ms_standalone) {
      return section === "progress";
    } else {
      return true;
    }
  }

  setSection(section) {
    var j, len, ref, s;
    if (!this.isSectionAllowed(section)) {
      section = "progress";
    }
    this.current = section;
    ref = this.sections;
    for (j = 0, len = ref.length; j < len; j++) {
      s = ref[j];
      if (s === section) {
        document.getElementById(`usersettings-menu-${s}`).classList.add("selected");
        document.getElementById(`usersettings-${s}`).style.display = "block";
      } else {
        document.getElementById(`usersettings-menu-${s}`).classList.remove("selected");
        document.getElementById(`usersettings-${s}`).style.display = "none";
      }
    }
    if (this.current === "progress") {
      this.app.user_progress.update();
      this.app.user_progress.updateStatsPage();
    }
    this.resetChangePassword();
  }

  update() {
    var account_type, div, icon, key, ref, span, translator, value;
    if (this.app.user.flags.guest) {
      this.hideChangePassword();
      document.getElementById("usersettings-menu-settings").style.display = "none";
      document.getElementById("usersettings-menu-profile").style.display = "none";
    }
    document.getElementById("subscribe-newsletter").checked = this.app.user.flags["newsletter"] === true;
    document.getElementById("experimental-features").checked = this.app.user.flags["experimental"] === true;
    document.getElementById("experimental-features-setting").style.display = this.app.user.flags.validated ? "block" : "none";
    if (this.app.user.flags["validated"] === true) {
      document.getElementById("email-not-validated").style.display = "none";
    } else {
      document.getElementById("email-not-validated").style.display = "block";
    }
    this.nick_validator.set(this.app.user.nick);
    this.email_validator.set(this.app.user.email);
    translator = false;
    ref = this.app.user.flags;
    for (key in ref) {
      value = ref[key];
      if (key.startsWith("translator_") && value) {
        translator = true;
      }
    }
    document.getElementById("open-translation-app").style.display = translator ? "inline-block" : "none";
    this.nickUpdated();
    account_type = "Standard";
    if (this.app.user.flags.guest) {
      account_type = this.app.translator.get("Guest");
    } else {
      account_type = this.app.getTierName(this.app.user.flags.tier);
    }
    if (this.app.user.flags.tier) {
      icon = new Image;
      icon.src = location.origin + `/microstudio/patreon/badges/sprites/${this.app.user.flags.tier}.png`;
      icon.classList.add("pixelated");
      icon.style = "width: 32px; height: 32px; vertical-align: middle ; margin-right: 5px";
      div = document.getElementById("usersettings-account-type");
      div.innerHTML = "";
      div.appendChild(icon);
      span = document.createElement("span");
      span.innerText = account_type;
      div.appendChild(span);
    } else {
      document.getElementById("usersettings-account-type").innerText = account_type;
    }
    this.updateStorage();
    this.updateProfileImage();
    document.getElementById("usersettings-profile-description").value = this.app.user.info.description;
    this.resetChangePassword();
    if (!window.ms_standalone) {
      if (!this.app.user.flags.guest) {
        return document.getElementById("delete-account").style.display = "block";
      }
    }
  }

  updateStorage() {
    var percent, str;
    percent = Math.floor(this.app.user.info.size / this.app.user.info.max_storage * 100);
    str = this.app.translator.get("[STORAGE] used of [MAX_STORAGE] ([PERCENT] %)");
    str = str.replace("[STORAGE]", this.app.appui.displayByteSize(this.app.user.info.size));
    str = str.replace("[MAX_STORAGE]", this.app.appui.displayByteSize(this.app.user.info.max_storage));
    str = str.replace("[PERCENT]", percent);
    return document.getElementById("usersettings-storage").innerText = str;
  }

  nickUpdated() {
    document.getElementById("user-public-page").href = location.origin.replace(".dev", ".io") + `/${this.app.user.nick}/`;
    return document.getElementById("user-public-page").innerHTML = location.host.replace(".dev", ".io") + `/${this.app.user.nick} <i class='fa fa-external-link-alt'></i>`;
  }

  resendValidationEMail() {
    return this.app.client.sendRequest({
      name: "send_validation_mail"
    }, function(msg) {
      document.getElementById("resend-validation-email").style.display = "none";
      return document.getElementById("validation-email-resent").style.display = "block";
    });
  }

  changePassword() {}

  newsletterChange() {
    var checked;
    checked = document.getElementById("subscribe-newsletter").checked;
    this.app.user.flags.newsletter = checked;
    return this.app.client.sendRequest({
      name: "change_newsletter",
      newsletter: checked
    });
  }

  experimentalChange() {
    var checked;
    checked = document.getElementById("experimental-features").checked;
    this.app.user.flags.experimental = checked;
    return this.app.client.sendRequest({
      name: "change_experimental",
      experimental: checked
    });
  }

  nickChange() {}

  emailChange() {}

  openTranslationApp() {
    document.getElementById("usersettings").style.display = "none";
    document.getElementById("translation-app").style.display = "block";
    if (this.translation_app != null) {
      return this.translation_app.update();
    } else {
      return this.translation_app = new TranslationApp(this.app);
    }
  }

  closeTranslationApp() {
    document.getElementById("usersettings").style.display = "block";
    return document.getElementById("translation-app").style.display = "none";
  }

  profileImageDropped(file) {
    var img, reader;
    reader = new FileReader();
    img = new Image;
    reader.addEventListener("load", () => {
      return img.src = reader.result;
    });
    reader.readAsDataURL(file);
    //url = "data:application/javascript;base64,"+btoa(Audio.processor)
    return img.onload = () => {
      var canvas, context, h, r, w;
      if (img.complete && img.width > 0 && img.height > 0) {
        canvas = document.createElement("canvas");
        canvas.width = 128;
        canvas.height = 128;
        context = canvas.getContext("2d");
        if (img.width < 128 && img.height < 128) {
          context.imageSmoothingEnabled = false;
        }
        w = img.width;
        h = img.height;
        r = Math.max(128 / w, 128 / h);
        w *= r;
        h *= r;
        context.drawImage(img, 64 - w / 2, 64 - h / 2, w, h);
        document.querySelector("#usersettings-profile-image img").src = canvas.toDataURL();
        document.querySelector("#usersettings-profile-image img").style.display = "block";
        return this.app.client.sendRequest({
          name: "set_user_profile",
          image: canvas.toDataURL().split(",")[1]
        }, () => {
          this.app.user.flags.profile_image = true;
          return this.updateProfileImage();
        });
      }
    };
  }

  removeProfileImage() {
    return this.app.client.sendRequest({
      name: "set_user_profile",
      image: 0
    }, (msg) => {
      this.app.user.flags.profile_image = false;
      document.querySelector("#usersettings-profile-image img").style.display = "none";
      document.querySelector("#usersettings-profile-image img").src = "";
      return this.updateProfileImage();
    });
  }

  profileDescriptionChanged() {
    if (this.description_timeout != null) {
      clearTimeout(this.description_timeout);
    }
    return this.description_timeout = setTimeout((() => {
      return this.saveProfileDescription();
    }), 2000);
  }

  saveProfileDescription() {
    return this.app.client.sendRequest({
      name: "set_user_profile",
      description: document.getElementById("usersettings-profile-description").value
    }, (msg) => {});
  }

  updateProfileImage() {
    if (this.app.user.flags.profile_image) {
      document.querySelector("#login-info img").style.display = "inline-block";
      document.querySelector("#login-info img").src = `/${this.app.user.nick}.png?v=${Date.now()}`;
      document.querySelector("#login-info i").style.display = "none";
      document.querySelector("#usersettings-profile-image img").src = `/${this.app.user.nick}.png?v=${Date.now()}`;
      document.querySelector("#usersettings-profile-image img").style.display = "block";
      return document.querySelector("#usersettings-profile-image .fa-times-circle").style.display = "block";
    } else {
      document.querySelector("#login-info img").style.display = "none";
      document.querySelector("#login-info i").style.display = "inline-block";
      return document.querySelector("#usersettings-profile-image .fa-times-circle").style.display = "none";
    }
  }

  resetChangePassword() {
    return this.setChangePasswordOpen(false);
  }

  setChangePasswordOpen(open) {
    var view;
    view = document.getElementById("usersetting-change-password-view");
    if (open) {
      view.style.height = "260px";
    } else {
      view.style.height = "0px";
    }
    document.getElementById("usersetting-password-current").value = "";
    document.getElementById("usersetting-password-new1").value = "";
    document.getElementById("usersetting-password-new2").value = "";
    return document.getElementById("usersetting-password-error").innerText = "";
  }

  changePasswordClick() {
    var current, open, pw1, pw2, view;
    view = document.getElementById("usersetting-change-password-view");
    open = view.getBoundingClientRect().height > 0;
    if (open) {
      current = document.getElementById("usersetting-password-current");
      pw1 = document.getElementById("usersetting-password-new1");
      pw2 = document.getElementById("usersetting-password-new2");
      if (current.value.length > 0 && pw1.value.length > 0 && pw2.value.length > 0) {
        if (pw1.value === pw2.value) {
          return this.app.client.sendRequest({
            name: "change_password",
            current: current.value,
            new: pw1.value
          }, (msg) => {
            console.info(msg);
            if (msg.name === "error") {
              return document.getElementById("usersetting-password-error").innerText = this.app.translator.get("Wrong Password");
            } else {
              this.resetChangePassword();
              return this.app.appui.showNotification(this.app.translator.get("You have changed your password!"));
            }
          });
        } else {
          return document.getElementById("usersetting-password-error").innerText = this.app.translator.get("Passwords do not match");
        }
      } else {
        return this.resetChangePassword();
      }
    } else {
      return this.setChangePasswordOpen(true);
    }
  }

  hideChangePassword() {
    return document.getElementById("usersetting-change-password").style.display = "none";
  }

  deleteAccount() {
    var password, text;
    if (!document.getElementById("delete-account-button").classList.contains("enabled")) {
      return;
    }
    text = document.getElementById("delete-account-confirm").value;
    password = document.getElementById("delete-account-password").value;
    if (text === "DELETE MY ACCOUNT") {
      console.info(text);
      return this.app.client.sendRequest({
        name: "delete_account",
        confirm: text,
        password: password
      }, (msg) => {
        console.info(msg);
        if (msg.name === "error") {
          return document.getElementById("delete-account-error").innerText = this.app.translator.get(msg.error);
        } else {
          document.getElementById("delete-account-error").innerText = this.app.translator.get("Account Deleted Successfully. You will be redirected.");
          return setTimeout((() => {
            return window.location.href = "/";
          }), 4000);
        }
      });
    }
  }

};

this.TranslationApp = (function() {
  function TranslationApp(app) {
    this.app = app;
    this.update();
    this.edits = {};
    this.last_edit = 0;
    setInterval(((function(_this) {
      return function() {
        return _this.check();
      };
    })(this)), 100);
  }

  TranslationApp.prototype.update = function() {
    var key, ref, value;
    ref = this.app.user.flags;
    for (key in ref) {
      value = ref[key];
      if (key.startsWith("translator_") && value) {
        this.lang = key.split("_")[1];
      }
    }
    this.app.client.sendRequest({
      name: "get_translation_list"
    }, (function(_this) {
      return function(msg) {
        _this.list = msg.list;
        return _this.refresh();
      };
    })(this));
    return this.app.client.sendRequest({
      name: "get_language",
      language: this.lang
    }, (function(_this) {
      return function(msg) {
        _this.language = JSON.parse(msg.language);
        return _this.refresh();
      };
    })(this));
  };

  TranslationApp.prototype.refresh = function() {
    var text;
    if ((this.list != null) && (this.language != null)) {
      document.getElementById("translation-app-contents").innerHTML = "";
      for (text in this.list) {
        this.add(text, this.language[text]);
      }
    }
  };

  TranslationApp.prototype.add = function(text, translation) {
    var div, i1, i2;
    div = document.createElement("div");
    i1 = document.createElement("input");
    i1.value = text;
    i1.readOnly = true;
    div.appendChild(i1);
    i2 = document.createElement("input");
    i2.value = translation || "";
    div.appendChild(i2);
    i2.addEventListener("input", (function(_this) {
      return function() {
        var trans;
        trans = i2.value;
        _this.edits[text] = trans;
        return _this.last_edit = Date.now();
      };
    })(this));
    return document.getElementById("translation-app-contents").appendChild(div);
  };

  TranslationApp.prototype.check = function() {
    var key, ref, value;
    if (this.last_edit > 0 && Date.now() > this.last_edit + 2000) {
      this.last_edit = 0;
      ref = this.edits;
      for (key in ref) {
        value = ref[key];
        delete this.edits[key];
        this.app.client.sendRequest({
          name: "set_translation",
          language: this.lang,
          source: key,
          translation: value
        });
      }
    }
  };

  return TranslationApp;

})();

var Levels;

this.UserProgress = (function() {
  function UserProgress(app) {
    this.app = app;
    this.levels = new Levels();
    setInterval(((function(_this) {
      return function() {
        return _this.updateXP();
      };
    })(this)), 50);
    this.target_xp = 0;
    this.xp = 0;
  }

  UserProgress.prototype.init = function() {
    var level, xp;
    if (this.app.user != null) {
      document.getElementById("header-progress-summary").classList.remove("hidden");
      level = this.app.user.info.stats.level || 0;
      xp = this.app.user.info.stats.xp || 0;
      document.getElementById("header-progress-level").innerText = this.app.translator.get("Level %NUM%").replace("%NUM%", level);
      return this.target_xp = xp;
    }
  };

  UserProgress.prototype.update = function() {
    var level, xp;
    if (this.app.user != null) {
      document.getElementById("header-progress-summary").classList.remove("hidden");
      level = this.app.user.info.stats.level || 0;
      xp = this.app.user.info.stats.xp || 0;
      document.getElementById("header-progress-level").innerText = this.app.translator.get("Level %NUM%").replace("%NUM%", level);
      this.target_xp = xp;
      this.checkLevel();
      return this.checkAchievements();
    }
  };

  UserProgress.prototype.checkLevel = function() {
    var level;
    if (this.app.user != null) {
      if (this.level == null) {
        this.level = this.app.user.info.stats.level || 0;
      } else {
        level = this.app.user.info.stats.level || 0;
        if (level > this.level) {
          this.level = level;
          this.addNotification(null, this.app.translator.get("Level %LEVEL% unlocked!").replace("%LEVEL%", level));
        }
      }
    }
  };

  UserProgress.prototype.checkAchievements = function() {
    var a, j, k, len, len1, ref, ref1;
    if (this.app.user != null) {
      if (this.achievements == null) {
        this.achievements = {};
        ref = this.app.user.info.achievements;
        for (j = 0, len = ref.length; j < len; j++) {
          a = ref[j];
          this.achievements[a.id] = true;
        }
      } else {
        ref1 = this.app.user.info.achievements;
        for (k = 0, len1 = ref1.length; k < len1; k++) {
          a = ref1[k];
          if (!this.achievements[a.id]) {
            this.achievements[a.id] = true;
            this.addNotification("/img/achievements/" + a.id + ".png", this.app.translator.get("New achievement unlocked!"));
          }
        }
      }
    }
  };

  UserProgress.prototype.updateXP = function() {
    var dxp, level, percent, xp, xp1, xp2;
    if (this.app.user == null) {
      return;
    }
    if (this.target_xp > 0 && this.target_xp === this.xp) {
      return;
    }
    this.xp += (this.target_xp - this.xp) * .1;
    if (Math.abs(this.target_xp - this.xp) < 1) {
      this.xp = this.target_xp;
    }
    xp = Math.round(this.xp);
    level = this.app.user.info.stats.level || 0;
    xp1 = level > 0 ? this.levels.total_cost[level - 1] : 0;
    xp2 = this.levels.total_cost[level];
    dxp = xp2 - xp1;
    percent = Math.max(0, Math.min(99, Math.floor((xp - xp1) / dxp * 100)));
    xp = this.displayNumber(xp);
    document.getElementById("header-progress-xp").innerText = xp;
    return this.setProgressBar("header-progress-xp", percent);
  };

  UserProgress.prototype.setProgressBar = function(id, percent) {
    if (document.getElementById(id) == null) {
      return;
    }
    return document.getElementById(id).style.background = "linear-gradient(90deg,hsl(200,50%,40%) 0%,hsl(0,50%,40%) " + percent + "%,hsl(200,10%,5%) " + percent + "%)";
  };

  UserProgress.prototype.displayNumber = function(x) {
    var list;
    x = "" + x;
    list = [];
    while (x.length > 3) {
      list.splice(0, 0, x.substring(x.length - 3, x.length));
      x = x.substring(0, x.length - 3);
    }
    list.splice(0, 0, x);
    return list.join(" ");
  };

  UserProgress.prototype.updateStatsPage = function() {
    var a, bonus, div, div_achievements, div_level, div_stats, dxp, j, k, key, len, len1, level, list, map, percent, results, unit, value, xp, xp1, xp2;
    div_level = document.getElementById("user-progress-level");
    div_level.innerHTML = "";
    div_stats = document.getElementById("user-progress-statistics");
    div_stats.innerHTML = "";
    map = {
      pixels_drawn: "Pixels Drawn",
      map_cells_drawn: "Map Cells Painted",
      characters_typed: "Characters Typed",
      lines_of_code: "Lines of Code",
      time_coding: "Coding Time",
      time_drawing: "Drawing Time",
      time_mapping: "Map Editor Time",
      xp: "XP",
      level: "Level"
    };
    list = ["level", "xp", "characters_typed", "lines_of_code", "pixels_drawn", "map_cells_drawn", "time_coding", "time_drawing", "time_mapping"];
    for (j = 0, len = list.length; j < len; j++) {
      key = list[j];
      value = this.app.user.info.stats[key];
      if (value == null) {
        continue;
      }
      unit = "";
      if (key.startsWith("time")) {
        if (value >= 60) {
          unit = this.app.translator.get("hours");
          value = Math.floor(value / 60);
        } else {
          unit = this.app.translator.get("minutes");
        }
      }
      div = key === "xp" || key === "level" ? div_level : div_stats;
      div.innerHTML += "<div class=\"user-progress-stat\" id=\"user-progress-stat-" + key + "\">\n  <div class=\"user-progress-stat-value\">" + (this.displayNumber(value)) + "<span class=\"unit\">" + unit + "</span></div>\n  <div class=\"user-progress-stat-label\">" + (map[key] ? this.app.translator.get(map[key]) : key) + "</div>\n</div>";
    }
    xp = this.app.user.info.stats.xp;
    level = this.app.user.info.stats.level;
    xp1 = level > 0 ? this.levels.total_cost[level - 1] : 0;
    xp2 = this.levels.total_cost[level];
    dxp = xp2 - xp1;
    percent = Math.max(0, Math.min(99, Math.floor((xp - xp1) / dxp * 100)));
    this.setProgressBar("user-progress-stat-xp", percent);
    div_achievements = document.getElementById("user-progress-achievements");
    div_achievements.innerHTML = "";
    list = this.app.user.info.achievements;
    list.sort(function(a, b) {
      return b.date - a.date;
    });
    if (list.length > 0) {
      document.getElementById("number-of-achievements").innerText = " (" + list.length + ")";
    } else {
      document.getElementById("number-of-achievements").innerText = "";
    }
    results = [];
    for (k = 0, len1 = list.length; k < len1; k++) {
      a = list[k];
      bonus = "";
      if (a.info.xp != null) {
        bonus = "<div class=\"bonus\">XP bonus +" + a.info.xp + "</div>";
      }
      bonus += "<div class=\"date\">" + (new Date(a.date).toLocaleDateString()) + "</div>";
      results.push(div_achievements.innerHTML += "<div class=\"user-progress-achievement\">\n  <img src=\"/img/achievements/" + a.id + ".png\" />\n  " + bonus + "\n  <h3>" + (this.app.translator.get(a.info.name)) + "</h3>\n  <p>" + (this.app.translator.get(a.info.description)) + "</p>\n  " + (a.info.story != null ? "<p class='story'>" + this.app.translator.get(a.info.story) + "</p>" : "") + "\n  <div style=\"clear: both\"></div>\n</div>");
    }
    return results;
  };

  UserProgress.prototype.addNotification = function(image, text) {
    var div, i, parent;
    parent = document.getElementById("user-progress-notifications");
    div = document.createElement("div");
    div.classList.add("user-progress-notification");
    i = document.createElement("i");
    i.classList.add("fa");
    i.classList.add("fa-times");
    i.classList.add("close");
    if (image != null) {
      div.innerHTML += "<img src=\"" + image + "\" />";
    }
    div.innerHTML += " " + text + "<div style='clear:both'></div>";
    setTimeout(((function(_this) {
      return function() {
        div.style.left = "400px";
        return setTimeout((function() {
          if (parent.contains(div)) {
            return parent.removeChild(div);
          }
        }), 1000);
      };
    })(this)), 12000);
    div.addEventListener("click", (function(_this) {
      return function() {
        _this.app.openUserProgress();
        div.style.left = "400px";
        return setTimeout((function() {
          if (parent.contains(div)) {
            return parent.removeChild(div);
          }
        }), 1000);
      };
    })(this));
    div.insertBefore(i, div.childNodes[0]);
    i.addEventListener("click", (function(_this) {
      return function(event) {
        event.stopPropagation();
        div.style.left = "400px";
        return setTimeout((function() {
          if (parent.contains(div)) {
            return parent.removeChild(div);
          }
        }), 1000);
      };
    })(this));
    setTimeout(((function(_this) {
      return function() {
        return div.style.left = "0px";
      };
    })(this)), 100);
    return parent.appendChild(div);
  };

  return UserProgress;

})();

Levels = (function() {
  function _Class() {
    var i, j, sum;
    this.total_cost = [];
    sum = 0;
    for (i = j = 0; j <= 499; i = j += 1) {
      sum += this.costOfLevelUp(i);
      this.total_cost[i] = sum;
    }
  }

  _Class.prototype.costOfLevelUp = function(from_level) {
    var xp;
    return xp = (from_level + 5) * (from_level + 5) * 20;
  };

  return _Class;

})();

this.DrawTool = (function() {
  class DrawTool {
    constructor(name, icon) {
      this.name = name;
      this.icon = icon;
      this.parameters = {};
      this.hsymmetry = false;
      this.vsymmetry = false;
      this.tile = true;
    }

    getSize(sprite) {
      var size;
      if (this.parameters["Size"]) {
        size = Math.min(sprite.width - 1, sprite.height - 1, 99) * this.parameters["Size"].value / 100;
        size = 1 + Math.floor(size);
        return size;
      } else {
        return 1;
      }
    }

    getRoundness() {
      if (this.shape === "round") {
        return 1;
      } else {
        return 0;
      }
    }

    start(sprite, x, y, button, shiftkey) {
      this.pixels = {};
      if (!shiftkey) {
        this.last_x = x;
        this.last_y = y;
      }
      return this.move(sprite, x, y, button);
    }

    move(sprite, x, y, button, pass = 0) {
      var d, i, k, ref1, xx, yy;
      if (Math.abs(x - this.last_x) < 2 && Math.abs(y - this.last_y) < 2) {
        this.domove(sprite, x, y, button, pass);
      } else {
        d = Math.max(Math.abs(x - this.last_x), Math.abs(y - this.last_y));
        for (i = k = 1, ref1 = d; k <= ref1; i = k += 1) {
          xx = Math.round(this.last_x + (x - this.last_x) * i / d);
          yy = Math.round(this.last_y + (y - this.last_y) * i / d);
          this.domove(sprite, xx, yy, button, pass);
        }
      }
      this.last_x = x;
      return this.last_y = y;
    }

    domove(sprite, x, y, button, pass = 0) {
      var d, d1, d2, di, dj, dn, i, ii, j, jj, k, m, nx, ny, r2, ref1, ref2, results, roundness, size, xx, yy;
      size = this.getSize(sprite);
      dn = size % 2 === 0 ? 1 : 0;
      if (pass < 1 && this.vsymmetry) {
        nx = sprite.width - 1 - x - dn;
        this.domove(sprite, nx, y, button, 1);
      }
      if (pass < 2 && this.hsymmetry) {
        ny = sprite.height - 1 - y - dn;
        this.domove(sprite, x, ny, button, 2);
      }
      d = (size - 1) / 2;
      d1 = Math.ceil(-d);
      d2 = Math.ceil(d);
      m = (d1 + d2) / 2;
      roundness = this.getRoundness();
      r2 = (d + .5) * (d + .5);
      r2 *= 1 + (1 - roundness);
      results = [];
      for (i = k = ref1 = d1, ref2 = d2; k <= ref2; i = k += 1) {
        results.push((function() {
          var l, ref3, ref4, results1;
          results1 = [];
          for (j = l = ref3 = d1, ref4 = d2; l <= ref4; j = l += 1) {
            di = i - m;
            dj = j - m;
            if (di * di + dj * dj > r2) {
              continue;
            }
            xx = x + i;
            yy = y + j;
            if (this.tile) {
              results1.push((function() {
                var n, results2;
                results2 = [];
                for (ii = n = -1; n <= 1; ii = n += 1) {
                  results2.push((function() {
                    var o, results3;
                    results3 = [];
                    for (jj = o = -1; o <= 1; jj = o += 1) {
                      results3.push(this.preprocessPixel(sprite, xx + ii * sprite.width, yy + jj * sprite.height, button));
                    }
                    return results3;
                  }).call(this));
                }
                return results2;
              }).call(this));
            } else {
              results1.push(this.preprocessPixel(sprite, xx, yy, button));
            }
          }
          return results1;
        }).call(this));
      }
      return results;
    }

    preprocessPixel(sprite, x, y, button) {
      if (x < 0 || x >= sprite.width || y < 0 || y >= sprite.height) {
        return;
      }
      if (this.pixels[`${x}-${y}`] == null) {
        this.pixels[`${x}-${y}`] = true;
        return this.processPixel(sprite, x, y, button);
      }
    }

    processPixel(sprite, x, y) {}

  };

  DrawTool.tools = [];

  return DrawTool;

}).call(this);

this.PencilTool = class PencilTool extends this.DrawTool {
  constructor() {
    super("Pencil", "fa-pencil-alt");
    this.parameters["Size"] = {
      type: "size_shape",
      value: 0
    };
    this.parameters["Opacity"] = {
      type: "range",
      value: 100
    };
    this.parameters["Color"] = {
      type: "color",
      value: "#FFF"
    };
  }

  processPixel(sprite, x, y, button) {
    var c;
    if (button === 2) {
      return sprite.erasePixel(x, y, this.parameters["Opacity"].value / 100);
    } else {
      c = sprite.getContext();
      c.globalAlpha = this.parameters["Opacity"].value / 100;
      c.fillStyle = this.parameters["Color"].value;
      c.fillRect(x, y, 1, 1);
      return c.globalAlpha = 1;
    }
  }

};

this.DrawTool.tools.push(new this.PencilTool());

this.EraserTool = class EraserTool extends this.DrawTool {
  constructor() {
    super("Eraser", "fa-eraser");
    this.parameters["Size"] = {
      type: "size_shape",
      value: 0
    };
    this.parameters["Opacity"] = {
      type: "range",
      value: 100
    };
  }

  processPixel(sprite, x, y) {
    return sprite.erasePixel(x, y, this.parameters["Opacity"].value / 100);
  }

};

this.DrawTool.tools.push(new this.EraserTool());

this.FillTool = class FillTool extends this.DrawTool {
  constructor() {
    super("Fill", "fa-fill-drip");
    this.parameters["Threshold"] = {
      type: "range",
      value: 0
    };
    this.parameters["Opacity"] = {
      type: "range",
      value: 100
    };
    this.parameters["Color"] = {
      type: "color",
      value: "#FFF"
    };
  }

  start(sprite, x, y) {
    var alpha, c, check, data, fill, index, list, p, ref, table, threshold;
    if (x < 0 || y < 0 || x >= sprite.width || y >= sprite.height) {
      return;
    }
    threshold = this.parameters["Threshold"].value / 100 * 255 + 1;
    alpha = this.parameters["Opacity"].value / 100;
    c = sprite.getContext();
    ref = c.getImageData(x, y, 1, 1);
    data = c.getImageData(0, 0, sprite.width, sprite.height);
    c.clearRect(x, y, 1, 1);
    c.globalAlpha = alpha;
    c.fillStyle = this.parameters["Color"].value;
    c.fillRect(x, y, 1, 1);
    c.globalAlpha = 1;
    fill = c.getImageData(x, y, 1, 1);
    list = [[x, y]];
    table = {};
    table[`${x}-${y}`] = true;
    check = function(x, y) {
      var da, db, dg, dr, index;
      if (x < 0 || y < 0 || x >= sprite.width || y >= sprite.height) {
        return false;
      }
      if (table[`${x}-${y}`]) {
        return false;
      }
      index = 4 * (x + y * sprite.width);
      dr = Math.abs(data.data[index] - ref.data[0]);
      dg = Math.abs(data.data[index + 1] - ref.data[1]);
      db = Math.abs(data.data[index + 2] - ref.data[2]);
      da = Math.abs(data.data[index + 3] - ref.data[3]);
      return Math.max(dr, dg, db, da) < threshold;
    };
    while (list.length > 0) {
      p = list.splice(0, 1)[0];
      x = p[0];
      y = p[1];
      index = 4 * (x + y * sprite.width);
      data.data[index] = fill.data[0];
      data.data[index + 1] = fill.data[1];
      data.data[index + 2] = fill.data[2];
      data.data[index + 3] = fill.data[3];
      if (check(x - 1, y)) {
        table[`${x - 1}-${y}`] = true;
        list.push([x - 1, y]);
      }
      if (check(x + 1, y)) {
        table[`${x + 1}-${y}`] = true;
        list.push([x + 1, y]);
      }
      if (check(x, y - 1)) {
        table[`${x}-${y - 1}`] = true;
        list.push([x, y - 1]);
      }
      if (check(x, y + 1)) {
        table[`${x}-${y + 1}`] = true;
        list.push([x, y + 1]);
      }
    }
    c.putImageData(data, 0, 0);
  }

  move(sprite, x, y) {}

};

this.DrawTool.tools.push(new this.FillTool());

this.BrightenTool = class BrightenTool extends this.DrawTool {
  constructor(parent) {
    super("Brighten", "fa-sun");
    this.parameters = parent.parameters;
  }

  processPixel(sprite, x, y) {
    var amount, b, c, data, db, dg, dr, g, r, v;
    amount = this.parameters["Amount"].value / 100;
    c = sprite.getContext();
    data = c.getImageData(x, y, 1, 1);
    r = data.data[0];
    g = data.data[1];
    b = data.data[2];
    v = (r + g + b) / 3;
    dr = r - v;
    dg = g - v;
    db = b - v;
    v = v * (1 + amount * .5);
    data.data[0] = Math.min(255, v + dr);
    data.data[1] = Math.min(255, v + dg);
    data.data[2] = Math.min(255, v + db);
    return c.putImageData(data, x, y);
  }

};

//@DrawTool.tools.push new @BrightenTool()
this.DarkenTool = class DarkenTool extends this.DrawTool {
  constructor(parent) {
    super("Darken", "fa-moon");
    this.parameters = parent.parameters;
  }

  processPixel(sprite, x, y) {
    var amount, b, c, data, db, dg, dr, g, r, v;
    amount = this.parameters["Amount"].value / 100;
    c = sprite.getContext();
    data = c.getImageData(x, y, 1, 1);
    r = data.data[0];
    g = data.data[1];
    b = data.data[2];
    v = (r + g + b) / 3;
    dr = r - v;
    dg = g - v;
    db = b - v;
    v = v * (1 - amount * .5);
    data.data[0] = Math.max(0, v + dr);
    data.data[1] = Math.max(0, v + dg);
    data.data[2] = Math.max(0, v + db);
    return c.putImageData(data, x, y);
  }

};

//@DrawTool.tools.push new @DarkenTool()
this.SmoothenTool = class SmoothenTool extends this.DrawTool {
  constructor(parent) {
    super("Smoothen", "fa-brush");
    this.parameters = parent.parameters;
  }

  processPixel(sprite, x, y) {
    var amount, c, co, coef, data, i, j, k, l, ref, sum, xx, yy;
    amount = this.parameters["Amount"].value / 100;
    c = sprite.getContext();
    sum = [0, 0, 0, 0];
    coef = 0;
    ref = c.getImageData(x, y, 1, 1);
    for (i = k = -1; k <= 1; i = k += 1) {
      for (j = l = -1; l <= 1; j = l += 1) {
        xx = x + i;
        yy = y + j;
        if (xx < 0 || yy < 0 || xx >= sprite.width || yy >= sprite.height) {
          continue;
        }
        data = c.getImageData(xx, yy, 1, 1);
        co = 1 / (1 + i * i + j * j) * (1 + data.data[3]);
        coef += co;
        sum[0] += data.data[0] * co;
        sum[1] += data.data[1] * co;
        sum[2] += data.data[2] * co;
        sum[3] += data.data[3] * co;
      }
    }
    data.data[0] = sum[0] / coef * amount + (1 - amount) * ref.data[0];
    data.data[1] = sum[1] / coef * amount + (1 - amount) * ref.data[1];
    data.data[2] = sum[2] / coef * amount + (1 - amount) * ref.data[2];
    data.data[3] = sum[3] / coef * amount + (1 - amount) * ref.data[3];
    return c.putImageData(data, x, y);
  }

};

//@DrawTool.tools.push new @SmoothenTool()
this.SharpenTool = class SharpenTool extends this.DrawTool {
  constructor(parent) {
    super("Sharpen", "fa-adjust");
    this.parameters = parent.parameters;
  }

  processPixel(sprite, x, y) {
    var amount, c, co, coef, data, i, j, k, l, ref, sum, xx, yy;
    amount = this.parameters["Amount"].value / 100;
    c = sprite.getContext();
    sum = [0, 0, 0, 0];
    coef = 0;
    ref = c.getImageData(x, y, 1, 1);
    for (i = k = -1; k <= 1; i = k += 1) {
      for (j = l = -1; l <= 1; j = l += 1) {
        if (i === 0 && j === 0) {
          continue;
        }
        xx = x + i;
        yy = y + j;
        if (xx < 0 || yy < 0 || xx >= sprite.width || yy >= sprite.height) {
          continue;
        }
        data = c.getImageData(xx, yy, 1, 1);
        co = 1 / (1 + i * i + j * j) * (1 + data.data[3]);
        coef += co;
        sum[0] += (ref.data[0] - data.data[0]) * co;
        sum[1] += (ref.data[1] - data.data[1]) * co;
        sum[2] += (ref.data[2] - data.data[2]) * co;
        sum[3] += (ref.data[3] - data.data[3]) * co;
      }
    }
    ref.data[0] += sum[0] / coef * amount;
    ref.data[1] += sum[1] / coef * amount;
    ref.data[2] += sum[2] / coef * amount;
    ref.data[3] += sum[3] / coef * amount;
    return c.putImageData(ref, x, y);
  }

};

//@DrawTool.tools.push new @EnhanceTool()
this.SaturationTool = class SaturationTool extends this.DrawTool {
  constructor(parent) {
    super("Saturation", "fa-palette");
    this.parameters = parent.parameters;
  }

  processPixel(sprite, x, y) {
    var amount, b, c, data, db, dg, dr, g, r, v;
    amount = this.parameters["Amount"].value / 100;
    amount = amount > .5 ? amount * 2 : .5 + amount;
    c = sprite.getContext();
    data = c.getImageData(x, y, 1, 1);
    r = data.data[0];
    g = data.data[1];
    b = data.data[2];
    v = (r + g + b) / 3;
    dr = r - v;
    dg = g - v;
    db = b - v;
    data.data[0] = Math.max(0, v + dr * amount);
    data.data[1] = Math.max(0, v + dg * amount);
    data.data[2] = Math.max(0, v + db * amount);
    return c.putImageData(data, x, y);
  }

};

//@DrawTool.tools.push new @SaturationTool()
this.EnhanceTool = class EnhanceTool extends this.DrawTool {
  constructor() {
    super("Enhance", "fa-magic");
    this.parameters["Tool"] = {
      type: "tool",
      set: [new BrightenTool(this), new DarkenTool(this), new SmoothenTool(this), new SharpenTool(this), new SaturationTool(this)],
      value: 0
    };
    this.parameters["Size"] = {
      type: "size_shape",
      value: 0
    };
    this.parameters["Amount"] = {
      type: "range",
      value: 50
    };
  }

  processPixel(sprite, x, y) {
    return this.parameters.Tool.set[this.parameters.Tool.value].processPixel(sprite, x, y);
  }

};

this.DrawTool.tools.push(new this.EnhanceTool());

this.SelectTool = class SelectTool extends this.DrawTool {
  constructor() {
    super("Select", "fa-vector-square");
    this.selectiontool = true;
  }

  processPixel(sprite, x, y) {}

};

this.DrawTool.tools.push(new this.SelectTool());

this.SpriteList = (function() {
  function SpriteList(app1) {
    this.app = app1;
    this.list = [];
    this.table = {};
    this.listeners = [];
  }

  SpriteList.prototype.add = function(sprite) {
    var j, len, lis, ref;
    if (this.list.indexOf(sprite) < 0) {
      this.list.push(sprite);
    }
    this.table[sprite.name] = sprite;
    ref = this.listeners;
    for (j = 0, len = ref.length; j < len; j++) {
      lis = ref[j];
      lis.spriteListChanged();
    }
  };

  SpriteList.prototype.rename = function(old_name, new_name) {
    var j, len, lis, ref;
    if (this.table[old_name] != null) {
      this.table[new_name] = this.table[old_name];
      delete this.table[old_name];
    }
    ref = this.listeners;
    for (j = 0, len = ref.length; j < len; j++) {
      lis = ref[j];
      lis.spriteListChanged();
    }
  };

  SpriteList.prototype.get = function(name) {
    return this.table[name];
  };

  SpriteList.prototype["delete"] = function(sprite) {
    var index, j, len, lis, ref;
    index = this.list.indexOf(sprite);
    if (index >= 0) {
      this.list.splice(index, 1);
    }
    delete this.table[sprite.name];
    ref = this.listeners;
    for (j = 0, len = ref.length; j < len; j++) {
      lis = ref[j];
      lis.spriteListChanged();
    }
  };

  SpriteList.prototype.addListener = function(listener) {
    return this.listeners.push(listener);
  };

  SpriteList.prototype.clear = function() {
    var j, key, len, lis, ref;
    this.list.length = 0;
    for (key in this.table) {
      delete this.table[key];
    }
    ref = this.listeners;
    for (j = 0, len = ref.length; j < len; j++) {
      lis = ref[j];
      lis.spriteListChanged();
    }
  };

  SpriteList.prototype.listFiles = function() {
    var i, j, ref, results;
    results = [];
    for (i = j = 0, ref = this.list.length - 1; j <= ref; i = j += 1) {
      results.push(this.list[i].name + ".png");
    }
    return results;
  };

  SpriteList.prototype.update = function(list) {
    var i, j, k, l, len, len1, lis, name, ref, ref1, s, u, url;
    for (i = j = ref = this.list.length - 1; j >= 0; i = j += -1) {
      s = this.list[i];
      if (list.indexOf(s.name + ".png") < 0) {
        this.list.splice(i, 1);
      }
    }
    url = location.origin + ("/" + this.app.nick + "/" + app.project.slug + "/");
    for (k = 0, len = list.length; k < len; k++) {
      s = list[k];
      u = url + s;
      name = s.substring(0, s.length - 4);
      s = new Sprite(u);
      s.name = name;
      this.add(s);
    }
    ref1 = this.listeners;
    for (l = 0, len1 = ref1.length; l < len1; l++) {
      lis = ref1[l];
      lis.spriteListChanged();
    }
  };

  return SpriteList;

})();

this.SpriteEditor = class SpriteEditor extends Manager {
  constructor(app) {
    var i, l, len, ref, tool;
    super(app);
    this.folder = "sprites";
    this.item = "sprite";
    this.list_change_event = "spritelist";
    this.get_item = "getSprite";
    this.use_thumbnails = false;
    this.extensions = ["png", "jpg", "jpeg"];
    this.update_list = "updateSpriteList";
    this.init();
    this.splitbar.auto = 1;
    this.spriteview = new SpriteView(this);
    this.auto_palette = new AutoPalette(this);
    this.colorpicker = new ColorPicker(this);
    document.getElementById("colorpicker").appendChild(this.colorpicker.canvas);
    this.animation_panel = new AnimationPanel(this);
    this.save_delay = 1000;
    this.save_time = 0;
    setInterval((() => {
      return this.checkSave();
    }), this.save_delay / 2);
    document.getElementById("sprite-width").addEventListener("input", (event) => {
      return this.spriteDimensionChanged("width");
    });
    document.getElementById("sprite-height").addEventListener("input", (event) => {
      return this.spriteDimensionChanged("height");
    });
    document.getElementById("colortext").addEventListener("input", (event) => {
      return this.colortextChanged();
    });
    document.getElementById("colortext-copy").addEventListener("click", (event) => {
      return this.colortextCopy();
    });
    this.sprite_size_validator = new InputValidator([document.getElementById("sprite-width"), document.getElementById("sprite-height")], document.getElementById("sprite-size-button"), null, (value) => {
      return this.saveDimensionChange(value);
    });
    this.selected_sprite = null;
    this.app.appui.setAction("undo-sprite", () => {
      return this.undo();
    });
    this.app.appui.setAction("redo-sprite", () => {
      return this.redo();
    });
    this.app.appui.setAction("copy-sprite", () => {
      return this.copy();
    });
    this.app.appui.setAction("cut-sprite", () => {
      return this.cut();
    });
    this.app.appui.setAction("paste-sprite", () => {
      return this.paste();
    });
    this.app.appui.setAction("sprite-helper-tile", () => {
      return this.toggleTile();
    });
    this.app.appui.setAction("sprite-helper-vsymmetry", () => {
      return this.toggleVSymmetry();
    });
    this.app.appui.setAction("sprite-helper-hsymmetry", () => {
      return this.toggleHSymmetry();
    });
    this.app.appui.setAction("selection-operation-film", () => {
      return this.stripToAnimation();
    });
    this.app.appui.setAction("selection-action-horizontal-flip", () => {
      return this.flipHSprite();
    });
    this.app.appui.setAction("selection-action-vertical-flip", () => {
      return this.flipVSprite();
    });
    this.app.appui.setAction("selection-action-rotate-left", () => {
      return this.rotateSprite(-1);
    });
    this.app.appui.setAction("selection-action-rotate-right", () => {
      return this.rotateSprite(1);
    });
    document.addEventListener("keydown", (event) => {
      if (document.getElementById("spriteeditor").offsetParent == null) {
        return;
      }
      //console.info event
      if ((document.activeElement != null) && document.activeElement.tagName.toLowerCase() === "input") {
        return;
      }
      if (event.key === "Alt" && !this.tool.selectiontool) {
        this.setColorPicker(true);
        this.alt_pressed = true;
      }
      if (event.metaKey || event.ctrlKey) {
        switch (event.key) {
          case "z":
            this.undo();
            break;
          case "Z":
            this.redo();
            break;
          case "c":
            this.copy();
            break;
          case "x":
            this.cut();
            break;
          case "v":
            this.paste();
            break;
          default:
            return;
        }
        event.preventDefault();
        return event.stopPropagation();
      }
    });
    //console.info event
    document.addEventListener("keyup", (event) => {
      if (event.key === "Alt" && !this.tool.selectiontool) {
        this.setColorPicker(false);
        return this.alt_pressed = false;
      }
    });
    document.getElementById("eyedropper").addEventListener("click", () => {
      return this.setColorPicker(!this.spriteview.colorpicker);
    });
    ref = DrawTool.tools;
    for (i = l = 0, len = ref.length; l < len; i = ++l) {
      tool = ref[i];
      this.createToolButton(tool);
      this.createToolOptions(tool);
    }
    this.setSelectedTool(DrawTool.tools[0].icon);
    document.getElementById("spritelist").addEventListener("dragover", (event) => {
      return event.preventDefault();
    });
    //console.info event
    this.code_tip = new CodeSnippetField(this.app, "#sprite-code-tip");
    this.background_color_picker = new BackgroundColorPicker(this, ((color) => {
      this.spriteview.updateBackgroundColor();
      return document.getElementById("sprite-background-color").style.background = color;
    }), "sprite");
    document.getElementById("sprite-background-color").addEventListener("mousedown", (event) => {
      if (this.background_color_picker.shown) {
        return this.background_color_picker.hide();
      } else {
        this.background_color_picker.show();
        return event.stopPropagation();
      }
    });
  }

  createToolButton(tool) {
    var div, parent;
    parent = document.getElementById("spritetools");
    div = document.createElement("div");
    div.classList.add("spritetoolbutton");
    div.title = tool.name;
    div.innerHTML = `<i class='fa ${tool.icon}'></i><br />${this.app.translator.get(tool.name)}`;
    div.addEventListener("click", () => {
      return this.setSelectedTool(tool.icon);
    });
    div.id = `spritetoolbutton-${tool.icon}`;
    return parent.appendChild(div);
  }

  createToolOptions(tool) {
    var button, div, i, k, key, l, len, p, parent, ref, ref1, t, toolbox;
    parent = document.getElementById("spritetooloptionslist");
    div = document.createElement("div");
    ref = tool.parameters;
    for (key in ref) {
      p = ref[key];
      if (p.type === "range") {
        ((p, key) => {
          var input, label;
          label = document.createElement("label");
          label.innerText = key;
          div.appendChild(label);
          input = document.createElement("input");
          input.type = "range";
          input.min = "0";
          input.max = "100";
          input.value = p.value;
          input.addEventListener("input", (event) => {
            p.value = input.value;
            if (key === "Size") {
              return this.spriteview.showBrushSize();
            }
          });
          return div.appendChild(input);
        })(p, key);
      } else if (p.type === "size_shape") {
        ((p, key) => {
          var input, label, shape;
          label = document.createElement("label");
          label.innerText = key;
          div.appendChild(label);
          div.appendChild(document.createElement("br"));
          input = document.createElement("input");
          input.style = "width:70% ; vertical-align: top";
          input.type = "range";
          input.min = "0";
          input.max = "100";
          input.value = p.value;
          input.addEventListener("input", (event) => {
            p.value = input.value;
            if (key === "Size") {
              return this.spriteview.showBrushSize();
            }
          });
          div.appendChild(input);
          shape = document.createElement("i");
          shape.style = "verticla-align: top ; padding: 6px 8px ; background: hsl(200,50%,50%) ; border-radius: 4px ;margin-left: 5px ; cursor: pointer ; width: 15px";
          shape.classList.add("fas");
          shape.classList.add("fa-circle");
          shape.title = this.app.translator.get("Shape");
          tool.shape = "round";
          shape.addEventListener("click", () => {
            if (tool.shape === "round") {
              tool.shape = "square";
              shape.classList.remove("fa-circle");
              shape.classList.add("fa-square-full");
            } else {
              tool.shape = "round";
              shape.classList.add("fa-circle");
              shape.classList.remove("fa-square-full");
            }
            return this.spriteview.showBrushSize();
          });
          div.appendChild(shape);
          return div.appendChild(document.createElement("br"));
        })(p, key);
      } else if (p.type === "tool") {
        toolbox = document.createElement("div");
        toolbox.classList.add("toolbox");
        div.appendChild(toolbox);
        ref1 = p.set;
        for (k = l = 0, len = ref1.length; l < len; k = ++l) {
          t = ref1[k];
          button = document.createElement("div");
          button.classList.add("spritetoolbutton");
          if (k === 0) {
            button.classList.add("selected");
          }
          button.title = t.name;
          button.id = `spritetoolbutton-${t.icon}`;
          i = document.createElement("i");
          i.classList.add("fa");
          i.classList.add(t.icon);
          button.appendChild(i);
          button.appendChild(document.createElement("br"));
          button.appendChild(document.createTextNode(t.name));
          toolbox.appendChild(button);
          t.button = button;
          ((p, k) => {
            return button.addEventListener("click", () => {
              var len1, o, ref2, results;
              p.value = k;
              ref2 = p.set;
              results = [];
              for (i = o = 0, len1 = ref2.length; o < len1; i = ++o) {
                t = ref2[i];
                if (i === k) {
                  results.push(t.button.classList.add("selected"));
                } else {
                  results.push(t.button.classList.remove("selected"));
                }
              }
              return results;
            });
          })(p, k);
        }
      }
    }
    div.id = `spritetooloptions-${tool.icon}`;
    return parent.appendChild(div);
  }

  setSelectedTool(id) {
    var e, l, len, ref, tool;
    ref = DrawTool.tools;
    for (l = 0, len = ref.length; l < len; l++) {
      tool = ref[l];
      e = document.getElementById(`spritetoolbutton-${tool.icon}`);
      if (tool.icon === id) {
        this.tool = tool;
        e.classList.add("selected");
      } else {
        e.classList.remove("selected");
      }
      e = document.getElementById(`spritetooloptions-${tool.icon}`);
      if (tool.icon === id) {
        e.style.display = "block";
      } else {
        e.style.display = "none";
      }
    }
    document.getElementById("colorpicker-group").style.display = this.tool.parameters["Color"] != null ? "block" : "none";
    this.spriteview.update();
    return this.updateSelectionHints();
  }

  toggleTile() {
    this.spriteview.tile = !this.spriteview.tile;
    this.spriteview.update();
    if (this.spriteview.tile) {
      return document.getElementById("sprite-helper-tile").classList.add("selected");
    } else {
      return document.getElementById("sprite-helper-tile").classList.remove("selected");
    }
  }

  toggleVSymmetry() {
    this.spriteview.vsymmetry = !this.spriteview.vsymmetry;
    this.spriteview.update();
    if (this.spriteview.vsymmetry) {
      return document.getElementById("sprite-helper-vsymmetry").classList.add("selected");
    } else {
      return document.getElementById("sprite-helper-vsymmetry").classList.remove("selected");
    }
  }

  toggleHSymmetry() {
    this.spriteview.hsymmetry = !this.spriteview.hsymmetry;
    this.spriteview.update();
    if (this.spriteview.hsymmetry) {
      return document.getElementById("sprite-helper-hsymmetry").classList.add("selected");
    } else {
      return document.getElementById("sprite-helper-hsymmetry").classList.remove("selected");
    }
  }

  spriteChanged() {
    var s;
    if (this.ignore_changes) {
      return;
    }
    this.app.project.lockFile(`sprites/${this.selected_sprite}.png`);
    this.save_time = Date.now();
    s = this.app.project.getSprite(this.selected_sprite);
    if (s != null) {
      s.updated(this.spriteview.sprite.saveData());
    }
    // s.loaded() # triggers update of all maps
    this.app.project.addPendingChange(this);
    this.animation_panel.frameUpdated();
    this.auto_palette.update();
    this.app.project.notifyListeners(s);
    return this.app.runwindow.updateSprite(this.selected_sprite);
  }

  //@updateLocalSprites()
  checkSave(immediate = false, callback) {
    if (this.save_time > 0 && (immediate || Date.now() > this.save_time + this.save_delay)) {
      this.saveSprite(callback);
      return this.save_time = 0;
    } else {
      if (callback != null) {
        return callback();
      }
    }
  }

  forceSave(callback) {
    return this.checkSave(true, callback);
  }

  projectOpened() {
    super.projectOpened();
    this.app.project.addListener(this);
    return this.setSelectedSprite(null);
  }

  projectUpdate(change) {
    var c, name, sprite;
    super.projectUpdate(change);
    switch (change) {
      case "locks":
        this.updateCurrentFileLock();
        this.updateActiveUsers();
    }
    if (change instanceof ProjectSprite) {
      name = change.name;
      c = document.querySelector(`#sprite-image-${name}`);
      sprite = change;
      if ((c != null) && (c.updateSprite != null)) {
        return c.updateSprite();
      }
    }
  }

  updateCurrentFileLock() {
    var lock, user;
    if (this.selected_sprite != null) {
      this.spriteview.editable = !this.app.project.isLocked(`sprites/${this.selected_sprite}.png`);
    }
    lock = document.getElementById("sprite-editor-locked");
    if ((this.selected_sprite != null) && this.app.project.isLocked(`sprites/${this.selected_sprite}.png`)) {
      user = this.app.project.isLocked(`sprites/${this.selected_sprite}.png`).user;
      lock.style = `display: block; background: ${this.app.appui.createFriendColor(user)}`;
      return lock.innerHTML = `<i class='fa fa-user'></i> Locked by ${user}`;
    } else {
      return lock.style = "display: none";
    }
  }

  saveSprite(callback) {
    var data, pixels, saved, sprite;
    if ((this.selected_sprite == null) || !this.spriteview.sprite) {
      return;
    }
    data = this.spriteview.sprite.saveData().split(",")[1];
    sprite = this.spriteview.sprite;
    saved = false;
    pixels = this.spriteview.pixels_drawn;
    this.spriteview.pixels_drawn = 0;
    this.app.client.sendRequest({
      name: "write_project_file",
      project: this.app.project.id,
      file: `sprites/${this.selected_sprite}.png`,
      pixels: pixels,
      properties: {
        frames: this.spriteview.sprite.frames.length,
        fps: this.spriteview.sprite.fps
      },
      content: data
    }, (msg) => {
      saved = true;
      if (this.save_time === 0) {
        this.app.project.removePendingChange(this);
      }
      sprite.size = msg.size;
      if (callback != null) {
        return callback();
      }
    });
    return setTimeout((() => {
      if (!saved) {
        this.save_time = Date.now();
        return console.info("retrying sprite save...");
      }
    }), 10000);
  }

  createAsset(folder, name = "sprite", content = "") {
    return this.checkSave(true, () => {
      if (folder != null) {
        name = folder.getFullDashPath() + `-${name}`;
        folder.setOpen(true);
      }
      return this.createSprite(name, null);
    });
  }

  createSprite(name, img, callback) {
    return this.checkSave(true, () => {
      var height, sprite, width;
      if (img != null) {
        width = img.width;
        height = img.height;
      } else if (this.spriteview.selection != null) {
        width = Math.max(8, this.spriteview.selection.w);
        height = Math.max(8, this.spriteview.selection.h);
      } else {
        width = Math.max(8, this.spriteview.sprite.width);
        height = Math.max(8, this.spriteview.sprite.height);
      }
      sprite = this.app.project.createSprite(width, height, name);
      this.spriteview.setSprite(sprite);
      this.animation_panel.spriteChanged();
      if (img != null) {
        this.spriteview.getFrame().getContext().drawImage(img, 0, 0);
      }
      this.spriteview.update();
      this.setSelectedItem(sprite.name);
      this.spriteview.editable = true;
      return this.saveSprite(() => {
        this.rebuildList();
        if (callback != null) {
          return callback();
        }
      });
    });
  }

  setSelectedItem(name) {
    var sprite;
    this.checkSave(true);
    sprite = this.app.project.getSprite(name);
    if (sprite != null) {
      this.spriteview.setSprite(sprite);
    }
    this.spriteview.windowResized();
    this.spriteview.update();
    this.spriteview.editable = true;
    this.setSelectedSprite(name);
    return super.setSelectedItem(name);
  }

  setSelectedSprite(sprite) {
    var e;
    this.selected_sprite = sprite;
    this.animation_panel.spriteChanged();
    if (this.selected_sprite != null) {
      if (this.spriteview.sprite != null) {
        document.getElementById("sprite-width").value = this.spriteview.sprite.width;
        document.getElementById("sprite-height").value = this.spriteview.sprite.height;
        this.sprite_size_validator.update();
      }
      document.getElementById("sprite-width").disabled = false;
      document.getElementById("sprite-height").disabled = false;
      e = document.getElementById("spriteeditor");
      if (e.firstChild != null) {
        e.firstChild.style.display = "inline-block";
      }
      this.spriteview.windowResized();
    } else {
      document.getElementById("sprite-width").disabled = true;
      document.getElementById("sprite-height").disabled = true;
      e = document.getElementById("spriteeditor");
      if (e.firstChild != null) {
        e.firstChild.style.display = "none";
      }
    }
    this.updateCurrentFileLock();
    this.updateSelectionHints();
    this.auto_palette.update();
    this.updateCodeTip();
    return this.setCoordinates(-1, -1);
  }

  setSprite(data) {
    var img;
    data = "data:image/png;base64," + data;
    this.ignore_changes = true;
    img = new Image;
    img.src = data;
    img.crossOrigin = "Anonymous";
    return img.onload = () => {
      this.spriteview.sprite.load(img);
      this.spriteview.windowResized();
      this.spriteview.update();
      this.spriteview.editable = true;
      this.ignore_changes = false;
      this.spriteview.windowResized();
      document.getElementById("sprite-width").value = this.spriteview.sprite.width;
      document.getElementById("sprite-height").value = this.spriteview.sprite.height;
      return this.sprite_size_validator.update();
    };
  }

  setColor(color1) {
    this.color = color1;
    this.spriteview.setColor(this.color);
    this.auto_palette.colorPicked(this.color);
    return document.getElementById("colortext").value = this.color;
  }

  spriteDimensionChanged(dim) {
    if (this.selected_sprite === "icon") {
      if (dim === "width") {
        return document.getElementById("sprite-height").value = document.getElementById("sprite-width").value;
      } else {
        return document.getElementById("sprite-width").value = document.getElementById("sprite-height").value;
      }
    }
  }

  colortextChanged() {
    return this.colorpicker.colorPicked(document.getElementById("colortext").value);
  }

  colortextCopy() {
    var colortext, copy;
    copy = document.getElementById("colortext-copy");
    colortext = document.getElementById("colortext");
    copy.classList.remove("fa-copy");
    copy.classList.add("fa-check");
    setTimeout((() => {
      copy.classList.remove("fa-check");
      return copy.classList.add("fa-copy");
    }), 3000);
    return navigator.clipboard.writeText(`"${colortext.value}"`);
  }

  saveDimensionChange(value) {
    var err, h, w;
    if (this.app.project.isLocked(`sprites/${this.selected_sprite}.png`)) {
      return;
    }
    this.app.project.lockFile(`sprites/${this.selected_sprite}.png`);
    w = value[0];
    h = value[1];
    try {
      w = Number.parseFloat(w);
      h = Number.parseFloat(h);
    } catch (error) {
      err = error;
    }
    if ((this.selected_sprite !== "icon" || w === h) && Number.isInteger(w) && Number.isInteger(h) && w > 0 && h > 0 && w <= 1024 && h <= 1024 && (this.selected_sprite != null) && (w !== this.spriteview.sprite.width || h !== this.spriteview.sprite.height)) {
      if (this.spriteview.sprite.undo == null) {
        this.spriteview.sprite.undo = new Undo();
      }
      if (this.spriteview.sprite.undo.empty()) {
        this.spriteview.sprite.undo.pushState(this.spriteview.sprite.clone());
      }
      this.spriteview.sprite.resize(w, h);
      this.spriteview.sprite.undo.pushState(this.spriteview.sprite.clone());
      this.spriteview.windowResized();
      this.spriteview.update();
      this.spriteChanged();
      this.checkSave(true);
      document.getElementById("sprite-width").value = this.spriteview.sprite.width;
      document.getElementById("sprite-height").value = this.spriteview.sprite.height;
      return this.sprite_size_validator.update();
    } else {
      document.getElementById("sprite-width").value = this.spriteview.sprite.width;
      document.getElementById("sprite-height").value = this.spriteview.sprite.height;
      return this.sprite_size_validator.update();
    }
  }

  undo() {
    var s;
    if (this.app.project.isLocked(`sprites/${this.selected_sprite}.png`)) {
      return;
    }
    this.app.project.lockFile(`sprites/${this.selected_sprite}.png`);
    if (this.spriteview.sprite && (this.spriteview.sprite.undo != null)) {
      s = this.spriteview.sprite.undo.undo(() => {
        return this.spriteview.sprite.clone();
      });
      this.spriteview.selection = null;
      if (s != null) {
        this.spriteview.sprite.copyFrom(s);
        this.spriteview.update();
        document.getElementById("sprite-width").value = this.spriteview.sprite.width;
        document.getElementById("sprite-height").value = this.spriteview.sprite.height;
        this.sprite_size_validator.update();
        this.spriteview.windowResized();
        this.spriteChanged();
        return this.animation_panel.updateFrames();
      }
    }
  }

  redo() {
    var s;
    if (this.app.project.isLocked(`sprites/${this.selected_sprite}.png`)) {
      return;
    }
    this.app.project.lockFile(`sprites/${this.selected_sprite}.png`);
    if (this.spriteview.sprite && (this.spriteview.sprite.undo != null)) {
      s = this.spriteview.sprite.undo.redo();
      this.spriteview.selection = null;
      if (s != null) {
        this.spriteview.sprite.copyFrom(s);
        this.spriteview.update();
        document.getElementById("sprite-width").value = this.spriteview.sprite.width;
        document.getElementById("sprite-height").value = this.spriteview.sprite.height;
        this.sprite_size_validator.update();
        this.spriteview.windowResized();
        this.spriteChanged();
        return this.animation_panel.updateFrames();
      }
    }
  }

  copy() {
    if (this.tool.selectiontool && (this.spriteview.selection != null)) {
      this.clipboard = new Sprite(this.spriteview.selection.w, this.spriteview.selection.h);
      this.clipboard.frames[0].getContext().drawImage(this.spriteview.getFrame().canvas, -this.spriteview.selection.x, -this.spriteview.selection.y);
      return this.clipboard.partial = true;
    } else {
      return this.clipboard = this.spriteview.sprite.clone();
    }
  }

  cut() {
    var sel;
    if (this.app.project.isLocked(`sprites/${this.selected_sprite}.png`)) {
      return;
    }
    this.app.project.lockFile(`sprites/${this.selected_sprite}.png`);
    if (this.spriteview.sprite.undo == null) {
      this.spriteview.sprite.undo = new Undo();
    }
    if (this.spriteview.sprite.undo.empty()) {
      this.spriteview.sprite.undo.pushState(this.spriteview.sprite.clone());
    }
    if (this.tool.selectiontool && (this.spriteview.selection != null)) {
      this.clipboard = new Sprite(this.spriteview.selection.w, this.spriteview.selection.h);
      this.clipboard.frames[0].getContext().drawImage(this.spriteview.getFrame().canvas, -this.spriteview.selection.x, -this.spriteview.selection.y);
      this.clipboard.partial = true;
      sel = this.spriteview.selection;
      this.spriteview.getFrame().getContext().clearRect(sel.x, sel.y, sel.w, sel.h);
    } else {
      this.clipboard = this.spriteview.sprite.clone();
      this.spriteview.sprite.clear();
    }
    this.spriteview.sprite.undo.pushState(this.spriteview.sprite.clone());
    this.currentSpriteUpdated();
    return this.spriteChanged();
  }

  paste() {
    var x, y;
    if (this.app.project.isLocked(`sprites/${this.selected_sprite}.png`)) {
      return;
    }
    this.app.project.lockFile(`sprites/${this.selected_sprite}.png`);
    if (this.clipboard != null) {
      if (this.spriteview.sprite.undo == null) {
        this.spriteview.sprite.undo = new Undo();
      }
      if (this.spriteview.sprite.undo.empty()) {
        this.spriteview.sprite.undo.pushState(this.spriteview.sprite.clone());
      }
      if (this.clipboard.partial) {
        x = 0;
        y = 0;
        x = Math.max(0, Math.min(this.spriteview.sprite.width - this.clipboard.width, this.spriteview.mouse_x));
        y = Math.max(0, Math.min(this.spriteview.sprite.height - this.clipboard.height, this.spriteview.mouse_y));
        this.spriteview.floating_selection = {
          bg: this.spriteview.getFrame().clone().getCanvas(),
          fg: this.clipboard.frames[0].getCanvas()
        };
        this.spriteview.selection = {
          x: x,
          y: y,
          w: this.clipboard.frames[0].canvas.width,
          h: this.clipboard.frames[0].canvas.height
        };
        this.spriteview.getFrame().getContext().drawImage(this.clipboard.frames[0].getCanvas(), x, y);
        this.setSelectedTool("fa-vector-square");
      } else {
        if (this.selected_sprite !== "icon" || (this.clipboard.width === this.clipboard.height && this.clipboard.frames.length === 1)) {
          this.spriteview.sprite.copyFrom(this.clipboard);
        }
      }
      this.spriteview.sprite.undo.pushState(this.spriteview.sprite.clone());
      this.currentSpriteUpdated();
      return this.spriteChanged();
    }
  }

  currentSpriteUpdated() {
    this.spriteview.update();
    document.getElementById("sprite-width").value = this.spriteview.sprite.width;
    document.getElementById("sprite-height").value = this.spriteview.sprite.height;
    this.animation_panel.updateFrames();
    this.sprite_size_validator.update();
    return this.spriteview.windowResized();
  }

  setColorPicker(picker) {
    this.spriteview.colorpicker = picker;
    if (picker) {
      //@spriteview.canvas.classList.add "colorpicker"
      this.spriteview.canvas.style.cursor = "url( '/img/eyedropper.svg' ) 0 24, pointer";
      return document.getElementById("eyedropper").classList.add("selected");
    } else {
      //@spriteview.canvas.classList.remove "colorpicker"
      this.spriteview.canvas.style.cursor = "crosshair";
      return document.getElementById("eyedropper").classList.remove("selected");
    }
  }

  updateSelectionHints() {
    var h, w;
    if ((this.spriteview.selection != null) && this.tool.selectiontool) {
      document.getElementById("selection-group").style.display = "block";
      w = this.spriteview.selection.w;
      h = this.spriteview.selection.h;
      if (this.spriteview.sprite.frames.length === 1 && (this.spriteview.sprite.width / w) % 1 === 0 && (this.spriteview.sprite.height / h) % 1 === 0 && (this.spriteview.sprite.width / w >= 2 || this.spriteview.sprite.height / h >= 2)) {
        return document.getElementById("selection-operation-film").style.display = "block";
      } else {
        return document.getElementById("selection-operation-film").style.display = "none";
      }
    } else {
      return document.getElementById("selection-group").style.display = "none";
    }
  }

  stripToAnimation() {
    var h, i, index, j, l, m, n, o, ref, ref1, sprite, w;
    w = this.spriteview.selection.w;
    h = this.spriteview.selection.h;
    if (this.spriteview.sprite.frames.length === 1 && (this.spriteview.sprite.width / w) % 1 === 0 && (this.spriteview.sprite.height / h) % 1 === 0 && (this.spriteview.sprite.width / w >= 2 || this.spriteview.sprite.height / h >= 2)) {
      if (this.spriteview.sprite.undo == null) {
        this.spriteview.sprite.undo = new Undo();
      }
      if (this.spriteview.sprite.undo.empty()) {
        this.spriteview.sprite.undo.pushState(this.spriteview.sprite.clone());
      }
      n = this.spriteview.sprite.width / w;
      m = this.spriteview.sprite.height / h;
      sprite = new Sprite(w, h);
      index = 0;
      for (j = l = 0, ref = m - 1; l <= ref; j = l += 1) {
        for (i = o = 0, ref1 = n - 1; o <= ref1; i = o += 1) {
          sprite.frames[index] = new SpriteFrame(sprite, w, h);
          sprite.frames[index].getContext().drawImage(this.spriteview.sprite.frames[0].getCanvas(), -i * w, -j * h);
          index++;
        }
      }
      this.spriteview.sprite.copyFrom(sprite);
      this.spriteview.sprite.undo.pushState(this.spriteview.sprite.clone());
      this.currentSpriteUpdated();
      this.spriteChanged();
      return this.animation_panel.spriteChanged();
    }
  }

  flipHSprite() {
    if (this.app.project.isLocked(`sprites/${this.selected_sprite}.png`)) {
      return;
    }
    this.app.project.lockFile(`sprites/${this.selected_sprite}.png`);
    return this.spriteview.flipSprite("horizontal");
  }

  flipVSprite() {
    if (this.app.project.isLocked(`sprites/${this.selected_sprite}.png`)) {
      return;
    }
    this.app.project.lockFile(`sprites/${this.selected_sprite}.png`);
    return this.spriteview.flipSprite("vertical");
  }

  rotateSprite(direction) {
    if (this.app.project.isLocked(`sprites/${this.selected_sprite}.png`)) {
      return;
    }
    this.app.project.lockFile(`sprites/${this.selected_sprite}.png`);
    return this.spriteview.rotateSprite(direction);
  }

  fileDropped(file, folder) {
    var reader;
    console.info(`processing ${file.name}`);
    console.info("folder: " + folder);
    reader = new FileReader();
    reader.addEventListener("load", () => {
      var img;
      console.info("file read, size = " + reader.result.byteLength);
      if (reader.result.byteLength > 5000000) {
        this.app.appui.showNotification(this.app.translator.get("Image file is too heavy"));
        return;
      }
      img = new Image;
      img.src = reader.result;
      return img.onload = () => {
        var name, sprite;
        if (img.complete && img.width > 0 && img.height > 0 && img.width <= 2048 && img.height <= 2048) {
          name = file.name.split(".")[0];
          name = this.findNewFilename(name, "getSprite", folder);
          if (folder != null) {
            name = folder.getFullDashPath() + "-" + name;
          }
          if (folder != null) {
            folder.setOpen(true);
          }
          sprite = this.app.project.createSprite(name, img);
          this.setSelectedItem(name);
          return this.app.client.sendRequest({
            name: "write_project_file",
            project: this.app.project.id,
            file: `sprites/${name}.png`,
            properties: {},
            content: reader.result.split(",")[1]
          }, (msg) => {
            console.info(msg);
            this.app.project.removePendingChange(this);
            this.app.project.updateSpriteList();
            return this.checkNameFieldActivation();
          });
        } else {
          return this.app.appui.showNotification(this.app.translator.get("Image size is too large"));
        }
      };
    });
    return reader.readAsDataURL(file);
  }

  updateCodeTip() {
    var code, sprite;
    if ((this.selected_sprite != null) && (this.app.project.getSprite(this.selected_sprite) != null)) {
      sprite = this.app.project.getSprite(this.selected_sprite);
      code = `screen.drawSprite( "${this.selected_sprite.replace(/-/g, "/")}", x, y, ${sprite.width}, ${sprite.height} )`;
    } else {
      code = "";
    }
    return this.code_tip.set(code);
  }

  setCoordinates(x, y) {
    var e;
    e = document.getElementById("sprite-coordinates");
    if (x < 0 || y < 0) {
      return e.innerText = "";
    } else {
      return e.innerText = `${x} , ${y}`;
    }
  }

  renameItem(item, name) {
    this.app.project.changeSpriteName(item.name, name); // needed to trigger updating of maps
    return super.renameItem(item, name);
  }

};

this.ColorPicker = class ColorPicker {
  constructor(editor) {
    this.editor = editor;
    this.canvas = document.createElement("canvas");
    this.canvas.width = 146;
    this.num_blocks = 9;
    this.block = this.canvas.width / this.num_blocks;
    this.canvas.height = this.block * (2 + 1 + 1 + 1 + 1 + 1 + this.num_blocks) + 1;
    this.hue = this.num_blocks - 1;
    this.type = "color";
    this.saturation = (this.num_blocks - 1) / 2;
    this.lightness = this.num_blocks - 2;
    this.updateColor();
    this.update();
    this.canvas.addEventListener("mousedown", (event) => {
      return this.mouseDown(event);
    });
    this.canvas.addEventListener("mousemove", (event) => {
      return this.mouseMove(event);
    });
    document.addEventListener("mouseup", (event) => {
      return this.mouseUp(event);
    });
  }

  colorPicked(c) {
    var col, i, j, match;
    if (typeof c === "string") {
      match = /rgb\((\d{1,3}),(\d{1,3}),(\d{1,3})\)/.exec(c.replace(/ /g, ""));
      if ((match != null) && match.length >= 4) {
        c = [match[1] | 0, match[2] | 0, match[3] | 0];
      } else {
        return;
      }
    }
    for (i = j = 0; j <= 2; i = ++j) {
      c[i] = Math.max(0, Math.min(255, c[i]));
    }
    this.color = `rgb(${c[0]},${c[1]},${c[2]})`;
    this.editor.setColor(this.color);
    col = this.RGBtoHSV(c[0], c[1], c[2]);
    this.hue = Math.round(col.h * this.num_blocks * 2) % (this.num_blocks * 2);
    this.saturation = Math.round(col.s * this.num_blocks);
    this.lightness = Math.round(this.lightToValue(col.v) * this.num_blocks);
    if (this.saturation === 0 || this.lightness === 0) {
      this.type = "gray";
      this.lightness = Math.round(this.lightToValue(col.v) * (2 * this.num_blocks - 1)) / 2;
    } else {
      this.type = "color";
      this.saturation -= 1;
      this.lightness -= 1;
    }
    return this.update();
  }

  updateColor() {
    var col, h, s, v;
    if (this.type === "gray") {
      v = Math.floor(255 * this.valueToLight(this.lightness * 2 / (this.num_blocks * 2 - 1)));
      this.color = `rgb(${v},${v},${v})`;
    } else {
      h = this.hue / (this.num_blocks * 2);
      s = (this.saturation + 1) / this.num_blocks;
      v = this.valueToLight((this.lightness + 1) / this.num_blocks);
      col = this.HSVtoRGB(h, s, v);
      this.color = `rgb(${col.r},${col.g},${col.b})`;
    }
    return this.editor.setColor(this.color);
  }

  valueToLight(v) {
    return Math.pow(Math.max(0, v), 2.2);
  }

  lightToValue(l) {
    return Math.pow(Math.max(0, l), 1 / 2.2);
  }

  update() {
    var ay, col, context, grd, h, hue, j, k, l, light, m, n, ref, ref1, ref2, ref3, s, v, x, y;
    context = this.canvas.getContext("2d");
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    grd = context.createLinearGradient(0, 0, 0, this.canvas.height);
    grd.addColorStop(0, "#000");
    grd.addColorStop(.96, "#000");
    grd.addColorStop(1, "#444");
    context.fillStyle = grd;
    context.fillRect(0, 80, this.canvas.width, 18);
    context.fillRect(0, 112, this.canvas.width, this.canvas.height);
    grd = context.createLinearGradient(0, 0, this.canvas.width, 0);
    grd.addColorStop(0, "#333");
    grd.addColorStop(.3, "#000");
    grd.addColorStop(1, "#000");
    context.fillStyle = grd;
    context.fillRect(0, 48, this.canvas.width, 18);
    context.fillStyle = "#888";
    context.fillRoundRect(0, 0, this.canvas.width, this.block * 2, 5);
    context.fillStyle = this.color;
    context.fillRoundRect(1, 1, this.canvas.width - 2, this.block * 2 - 2, 5);
    grd = context.createLinearGradient(0, this.canvas.height - this.block * 2, 0, this.canvas.height, 0);
    grd.addColorStop(0, 'rgba(255,255,255,0)');
    grd.addColorStop(1, "rgba(255,255,255,.5)");
    context.fillStyle = grd;
//context.fillRect 0,@canvas.height-@block*2,@canvas.width,@block*2
//context.fillRect 0,@block*7,@canvas.width,@block*@num_blocks
    for (light = j = 0, ref = this.num_blocks * 2 - 1; j <= ref; light = j += 1) {
      if (this.type === "gray" && this.lightness * 2 === light) {
        context.fillStyle = "#FFF";
        context.fillRoundRect(light * this.block * .5 - 1, 3 * this.block - 1, this.block * .5 + 2, this.block + 2, 1);
      }
      l = this.valueToLight(light / (this.num_blocks * 2 - 1));
      context.fillStyle = `hsl(0,0%,${l * 100}%)`;
      context.fillRoundRect(light * this.block * .5 + 1, 3 * this.block + 1, this.block * .5 - 2, this.block - 2, 1);
    }
    for (hue = k = 0, ref1 = this.num_blocks * 2 - 1; k <= ref1; hue = k += 1) {
      if (this.type === "color" && hue === this.hue) {
        context.fillStyle = "#FFF";
        context.fillRoundRect(hue * this.block * .5 - 1, 5 * this.block - 1, this.block * .5 + 2, this.block + 2, 1);
      }
      context.fillStyle = `hsl(${hue / this.num_blocks * 180},60%,50%)`;
      context.fillRoundRect(hue * this.block * .5 + 1, 5 * this.block + 1, this.block * .5 - 2, this.block - 2, 1);
    }
    for (y = m = 0, ref2 = this.num_blocks - 1; m <= ref2; y = m += 1) {
      for (x = n = 0, ref3 = this.num_blocks - 1; n <= ref3; x = n += 1) {
        ay = this.num_blocks - 1 - y;
        if (this.type === "color" && ay === this.lightness && x === this.saturation && this.hue >= 0) {
          context.fillStyle = "#FFF";
          context.fillRoundRect(x * this.block - 1, (y + 7) * this.block - 1, this.block + 2, this.block + 2, 2);
        }
        h = this.hue / (this.num_blocks * 2);
        s = (x + 1) / this.num_blocks;
        v = this.valueToLight((ay + 1) / this.num_blocks);
        col = this.HSVtoRGB(h, s, v);
        context.fillStyle = `rgb(${col.r},${col.g},${col.b})`;
        l = this.num_blocks - 1 - light;
        context.fillRoundRect(x * this.block + 1, (y + 7) * this.block + 1, this.block - 2, this.block - 2, 2);
      }
    }
  }

  mouseDown(event) {
    this.mousepressed = true;
    return this.mouseMove(event);
  }

  mouseMove(event) {
    var b, hue, lightness, min, saturation, x, y;
    if (this.mousepressed) {
      b = this.canvas.getBoundingClientRect();
      min = Math.min(this.canvas.clientWidth, this.canvas.clientHeight);
      x = (event.clientX - b.left) / b.width * this.canvas.width;
      y = (event.clientY - b.top) / b.height * this.canvas.height;
      y = Math.floor(y / this.block);
      if (y === 3) {
        lightness = Math.floor(x / this.canvas.width * this.num_blocks * 2) / 2;
        if (lightness !== this.lightness || this.type !== "gray") {
          this.type = "gray";
          this.lightness = lightness;
          this.updateColor();
          this.update();
        }
      } else if (y === 5) {
        hue = Math.max(0, Math.floor(x / this.canvas.width * this.num_blocks * 2));
        if (hue !== this.hue || this.type !== this.color) {
          this.type = "color";
          this.lightness = Math.floor(this.lightness);
          this.hue = hue;
          this.updateColor();
          this.update();
        }
      } else if (y >= 7) {
        x = Math.floor(x / this.canvas.width * this.num_blocks);
        saturation = x;
        lightness = Math.max(0, this.num_blocks - 1 - (y - 7));
        if (lightness !== this.lightness || saturation !== this.saturation || this.type !== "color") {
          this.type = "color";
          this.lightness = lightness;
          this.saturation = saturation;
          this.updateColor();
          this.update();
        }
      }
    }
    return false;
  }

  mouseUp(event) {
    return this.mousepressed = false;
  }

  rgbToHsl(r, g, b) {
    var d, h, l, max, min, s;
    r /= 255;
    g /= 255;
    b /= 255;
    max = Math.max(r, g, b);
    min = Math.min(r, g, b);
    h = void 0;
    s = void 0;
    l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      // achromatic
      d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
      }
      h /= 6;
    }
    return [h, s, l];
  }

  HSVtoRGB(h, s, v) {
    var b, f, g, i, p, q, r, t;
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - (f * s));
    t = v * (1 - ((1 - f) * s));
    switch (i % 6) {
      case 0:
        r = v;
        g = t;
        b = p;
        break;
      case 1:
        r = q;
        g = v;
        b = p;
        break;
      case 2:
        r = p;
        g = v;
        b = t;
        break;
      case 3:
        r = p;
        g = q;
        b = v;
        break;
      case 4:
        r = t;
        g = p;
        b = v;
        break;
      case 5:
        r = v;
        g = p;
        b = q;
    }
    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  }

  RGBtoHSV(r, g, b) {
    var d, h, max, min, s, v;
    max = Math.max(r, g, b);
    min = Math.min(r, g, b);
    d = max - min;
    h = void 0;
    s = max === 0 ? 0 : d / max;
    v = max / 255;
    switch (max) {
      case min:
        h = 0;
        break;
      case r:
        h = g - b + d * (g < b ? 6 : 0);
        h /= 6 * d;
        break;
      case g:
        h = b - r + d * 2;
        h /= 6 * d;
        break;
      case b:
        h = r - g + d * 4;
        h /= 6 * d;
    }
    return {
      h: h,
      s: s,
      v: v
    };
  }

};

this.SpriteView = class SpriteView {
  constructor(editor) {
    this.editor = editor;
    this.canvas = document.querySelector("#spriteeditor canvas");
    this.canvas.width = 400;
    this.canvas.height = 400;
    this.sprite = new Sprite(32, 32);
    this.canvas.addEventListener("touchstart", (event) => {
      if ((event.touches != null) && (event.touches[0] != null)) {
        event.preventDefault(); // prevents a mousedown event from being triggered
        event.touches[0].stopPropagation = function() {
          return event.stopPropagation();
        };
        return this.mouseDown(event.touches[0]);
      }
    });
    document.addEventListener("touchmove", (event) => {
      if ((event.touches != null) && (event.touches[0] != null)) {
        return this.mouseMove(event.touches[0]);
      }
    });
    document.addEventListener("touchend", (event) => {
      return this.mouseUp();
    });
    this.canvas.addEventListener("touchcancel", (event) => {
      return this.mouseOut();
    });
    this.canvas.addEventListener("mousedown", (event) => {
      return this.mouseDown(event);
    });
    document.addEventListener("mousemove", (event) => {
      return this.mouseMove(event);
    });
    this.canvas.addEventListener("mouseout", (event) => {
      return this.mouseOut(event);
    });
    document.addEventListener("mouseup", (event) => {
      return this.mouseUp(event);
    });
    this.canvas.addEventListener("contextmenu", (event) => {
      return event.preventDefault();
    });
    this.canvas.addEventListener("mouseenter", (event) => {
      return this.mouseEnter(event);
    });
    this.brush_opacity = 1;
    this.brush_type = "paint";
    this.brush_size = 1;
    this.mouse_over = false;
    this.mouse_x = 0;
    this.mouse_y = 0;
    this.pixels_drawn = 0;
    window.addEventListener("resize", () => {
      return this.windowResized();
    });
    this.editable = false;
    this.tile = false;
    this.vsymmetry = false;
    this.hsymmetry = false;
    this.zoom = 1;
    document.getElementById("spriteeditor").addEventListener("mousewheel", ((e) => {
      return this.mouseWheel(e);
    }), false);
    document.getElementById("spriteeditor").addEventListener("DOMMouseScroll", ((e) => {
      return this.mouseWheel(e);
    }), false);
    document.getElementById("spriteeditor").addEventListener("mousedown", () => {
      if (this.selection != null) {
        this.selection = null;
        return this.update();
      }
    });
    document.getElementById("spriteeditor").addEventListener("keydown", (e) => {
      if (e.keyCode === 32) {
        this.space_pressed = true;
        this.canvas.style.cursor = "grab";
        e.preventDefault();
        return document.getElementById("sprite-grab-info").classList.add("active");
      } else if (e.keyCode === 18) { // Alt
        return document.getElementById("selection-hint-clone").classList.add("active");
      } else if (e.keyCode === 16) { // Shift
        return document.getElementById("selection-hint-move").classList.add("active");
      }
    });
    document.addEventListener("keyup", (e) => {
      if (e.keyCode === 32) {
        this.space_pressed = false;
        this.canvas.style.cursor = "crosshair";
        return document.getElementById("sprite-grab-info").classList.remove("active");
      } else if (e.keyCode === 18) { // Alt
        return document.getElementById("selection-hint-clone").classList.remove("active");
      } else if (e.keyCode === 16) { // Shift
        return document.getElementById("selection-hint-move").classList.remove("active");
      }
    });
    document.getElementById("sprite-zoom-plus").addEventListener("click", () => {
      return this.scaleZoom(1.1);
    });
    document.getElementById("sprite-zoom-minus").addEventListener("click", () => {
      return this.scaleZoom(1 / 1.100001);
    });
  }

  setSprite(sprite) {
    if (sprite !== this.sprite) {
      if (this.sprite != null) {
        this.saveZoom();
        this.sprite.selection = this.selection;
      }
      this.sprite = sprite;
      if (this.sprite.zoom != null) {
        this.restoreZoom();
      } else {
        this.scaleZoom(.5 / this.zoom);
      }
      this.selection = this.sprite.selection || null;
      return this.floating_selection = null;
    }
  }

  setCurrentFrame(index) {
    if (index !== this.sprite.current_frame) {
      this.sprite.setCurrentFrame(index);
      return this.selection = null;
    }
  }

  getFrame() {
    return this.sprite.frames[this.sprite.current_frame];
  }

  mouseWheel(e) {
    e.preventDefault();
    if (this.next_wheel_action == null) {
      this.next_wheel_action = Date.now();
    }
    if (Date.now() < this.next_wheel_action) {
      return;
    }
    this.next_wheel_action = Date.now() + 50;
    if (e.wheelDelta < 0 || e.detail > 0) {
      return this.scaleZoom(1 / 1.100001, e);
    } else {
      return this.scaleZoom(1.1, e);
    }
  }

  scaleZoom(scale, e) {
    var b, max_zoom, scroll_x, scroll_y, view, x, y;
    view = document.getElementById("spriteeditor").getBoundingClientRect();
    max_zoom = 4096 / Math.max(view.width, view.height);
    this.zoom = Math.max(1, Math.min(max_zoom, this.zoom * scale));
    if (e != null) {
      b = this.canvas.getBoundingClientRect();
      x = (e.clientX - b.left) / this.canvas.width;
      y = (e.clientY - b.top) / this.canvas.height;
    }
    this.windowResized();
    if (e != null) {
      view = document.getElementById("spriteeditor").getBoundingClientRect();
      scroll_x = view.x + this.canvas.width * x - e.clientX + 40;
      scroll_y = view.y + this.canvas.height * y - e.clientY + 40;
      document.getElementById("spriteeditor").scrollTo(scroll_x, scroll_y);
    }
    if (e != null) {
      this.mouseMove(e);
    }
    if (this.zoom > 1) {
      return document.getElementById("sprite-grab-info").style.display = "inline-block";
    } else {
      return document.getElementById("sprite-grab-info").style.display = "none";
    }
  }

  saveZoom() {
    var view;
    if (this.sprite != null) {
      view = document.getElementById("spriteeditor");
      return this.sprite.zoom = {
        zoom: this.zoom,
        left: view.scrollLeft,
        top: view.scrollTop
      };
    }
  }

  restoreZoom() {
    var view;
    if (this.sprite.zoom != null) {
      view = document.getElementById("spriteeditor");
      this.scaleZoom(this.sprite.zoom.zoom / this.zoom);
      return view.scrollTo(this.sprite.zoom.left, this.sprite.zoom.top);
    }
  }

  addPattern() {
    var c, context, data, i, k, l, line, ref, ref1, value;
    if (this.pattern != null) {
      return;
    }
    c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    context = c.getContext("2d");
    data = context.getImageData(0, 0, c.width, 1);
    for (line = k = 0, ref = c.height - 1; k <= ref; line = k += 1) {
      for (i = l = 0, ref1 = c.width - 1; l <= ref1; i = l += 1) {
        value = 128 + Math.random() * 64 - 32;
        data.data[i * 4] = value;
        data.data[i * 4 + 1] = value;
        data.data[i * 4 + 2] = value;
        data.data[i * 4 + 3] = 64;
      }
      context.putImageData(data, 0, line);
    }
    this.pattern = c.toDataURL();
    document.querySelector(".spriteeditor canvas").style["background-image"] = `url(${this.pattern})`;
    document.querySelector(".spriteeditor canvas").style["background-repeat"] = "repeat";
    return this.updateBackgroundColor();
  }

  updateBackgroundColor() {
    var c;
    if (this.editor.background_color_picker != null) {
      c = this.editor.background_color_picker.color;
      return document.querySelector(".spriteeditor canvas").style["background-color"] = c;
    } else {
      return document.querySelector(".spriteeditor canvas").style["background-color"] = "#000";
    }
  }

  setColor(color) {
    this.color = color;
  }

  windowResized() {
    var c, h, ratio, w;
    c = this.canvas.parentElement;
    if (c == null) {
      return;
    }
    if (c.clientWidth <= 0) {
      return;
    }
    w = c.clientWidth - 80;
    h = c.clientHeight - 80;
    ratio = Math.min(w / this.sprite.width, h / this.sprite.height);
    w = Math.floor(ratio * this.sprite.width * this.zoom);
    h = Math.floor(ratio * this.sprite.height * this.zoom);
    if (w !== this.canvas.width || h !== this.canvas.height) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.update();
    }
    h = Math.max(40, (c.clientHeight - h) / 2);
    return this.canvas.style["margin-top"] = h + "px";
  }

  showBrushSize() {
    this.show_brush_size = Date.now() + 2000;
    return this.update();
  }

  drawGrid(ctx) {
    var context, hblock, hoffset, i, k, l, lw, m, modulo, n, ref, ref1, ref2, ref3, ref4, ref5, ref6, ref7, wblock, woffset;
    if ((this.grid_buffer == null) || this.grid_buffer.width !== this.canvas.width || this.grid_buffer.height !== this.canvas.height || this.tile !== this.grid_tile || this.grid_sw !== this.sprite.width || this.grid_sh !== this.sprite.height) {
      if (this.grid_buffer == null) {
        this.grid_buffer = document.createElement("canvas");
      }
      this.grid_buffer.width = this.canvas.width;
      this.grid_buffer.height = this.canvas.height;
      this.grid_tile = this.tile;
      this.grid_sw = this.sprite.width;
      this.grid_sh = this.sprite.height;
      console.info("updating grid");
      wblock = this.canvas.width / this.sprite.width;
      hblock = this.canvas.height / this.sprite.height;
      if (this.tile) {
        wblock /= 2;
        hblock /= 2;
      }
      context = this.grid_buffer.getContext("2d");
      context.lineWidth = 1;
      context.strokeStyle = "rgba(0,0,0,.1)";
      woffset = this.tile && this.sprite.width % 2 > 0 ? wblock * .5 : 0;
      hoffset = this.tile && this.sprite.height % 2 > 0 ? hblock * .5 : 0;
      modulo = this.sprite.width % 8 === 0 ? 8 : 10;
      if (wblock < 3) {
        return;
      }
      for (i = k = 0, ref = this.canvas.width, ref1 = wblock; ref1 !== 0 && (ref1 > 0 ? k <= ref : k >= ref); i = k += ref1) {
        lw = Math.round(i / hblock) % modulo === 0 ? 2 : 1;
        context.lineWidth = lw;
        context.beginPath();
        context.moveTo(i + .25 * lw + woffset, 0);
        context.lineTo(i + .25 * lw + woffset, this.canvas.height);
        context.stroke();
      }
      for (i = l = 0, ref2 = this.canvas.height, ref3 = hblock; ref3 !== 0 && (ref3 > 0 ? l <= ref2 : l >= ref2); i = l += ref3) {
        lw = Math.round(i / hblock) % modulo === 0 ? 2 : 1;
        context.lineWidth = lw;
        context.beginPath();
        context.moveTo(0, i + .25 * lw + hoffset);
        context.lineTo(this.canvas.width, i + .25 * lw + hoffset);
        context.stroke();
      }
      context.strokeStyle = "rgba(255,255,255,.1)";
      for (i = m = 0, ref4 = this.canvas.width, ref5 = wblock; ref5 !== 0 && (ref5 > 0 ? m <= ref4 : m >= ref4); i = m += ref5) {
        lw = Math.round(i / hblock) % modulo === 0 ? 2 : 1;
        context.lineWidth = lw;
        context.beginPath();
        context.moveTo(i - .25 * lw + woffset, 0);
        context.lineTo(i - .25 * lw + woffset, this.canvas.height);
        context.stroke();
      }
      for (i = n = 0, ref6 = this.canvas.height, ref7 = hblock; ref7 !== 0 && (ref7 > 0 ? n <= ref6 : n >= ref6); i = n += ref7) {
        lw = Math.round(i / hblock) % modulo === 0 ? 2 : 1;
        context.lineWidth = lw;
        context.beginPath();
        context.moveTo(0, i - .25 * lw + hoffset);
        context.lineTo(this.canvas.width, i - .25 * lw + hoffset);
        context.stroke();
      }
    }
    return ctx.drawImage(this.grid_buffer, 0, 0);
  }

  update() {
    var bs, context, d, f, grd, h, hblock, hoffset, i, j, k, l, m, mx, my, n, w, wblock, woffset;
    this.brush_size = this.editor.tool.getSize(this.sprite);
    context = this.canvas.getContext("2d");
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    context.imageSmoothingEnabled = false;
    this.addPattern();
    if (this.sprite.frames.length > 1) {
      f = this.sprite.frames[(this.sprite.current_frame + this.sprite.frames.length - 1) % this.sprite.frames.length];
      context.globalAlpha = .2;
      if (this.tile) {
        w = this.canvas.width;
        h = this.canvas.height;
        for (i = k = 0; k <= 2; i = k += 1) {
          for (j = l = 0; l <= 2; j = l += 1) {
            if (f.canvas != null) {
              context.drawImage(f.canvas, w * (-.25 + i * .5), h * (-.25 + j * .5), w * .5, h * .5);
            }
          }
        }
      } else {
        if (f.canvas != null) {
          context.drawImage(f.canvas, 0, 0, this.canvas.width, this.canvas.height);
        }
      }
      context.globalAlpha = 1;
    }
    if (this.tile) {
      w = this.canvas.width;
      h = this.canvas.height;
      for (i = m = 0; m <= 2; i = m += 1) {
        for (j = n = 0; n <= 2; j = n += 1) {
          if (this.getFrame().canvas != null) {
            context.drawImage(this.getFrame().canvas, w * (-.25 + i * .5), h * (-.25 + j * .5), w * .5, h * .5);
          }
        }
      }
    } else {
      if (this.getFrame().canvas != null) {
        context.drawImage(this.getFrame().canvas, 0, 0, this.canvas.width, this.canvas.height);
      }
    }
    wblock = this.canvas.width / this.sprite.width;
    hblock = this.canvas.height / this.sprite.height;
    if (this.tile) {
      wblock /= 2;
      hblock /= 2;
    }
    context.lineWidth = 1;
    context.strokeStyle = "rgba(0,0,0,.1)";
    woffset = this.tile && this.sprite.width % 2 > 0 ? wblock * .5 : 0;
    hoffset = this.tile && this.sprite.height % 2 > 0 ? hblock * .5 : 0;
    this.drawGrid(context);
    if ((this.mouse_over || Date.now() < this.show_brush_size) && this.canvas.style.cursor !== "move") {
      if (Date.now() < this.show_brush_size) {
        mx = Math.floor(this.sprite.width / 2 - 1) * (this.tile ? 2 : 1);
        my = Math.floor(this.sprite.height / 2 - 1) * (this.tile ? 2 : 1);
      } else {
        mx = this.mouse_x;
        my = this.mouse_y;
      }
      bs = Math.floor((this.brush_size - 1) / 2);
      context.strokeStyle = "#000";
      context.lineWidth = 4;
      context.beginPath();
      if (this.editor.tool.shape === "round") {
        d = this.brush_size % 2 ? 0 : .5;
        context.ellipse((mx + .5 + d) * wblock - woffset, (my + .5 + d) * hblock - hoffset, wblock * this.brush_size / 2, hblock * this.brush_size / 2, 0, 0, Math.PI * 2, true);
      } else {
        context.rect((mx - bs) * wblock - woffset, (my - bs) * hblock - hoffset, wblock * this.brush_size, hblock * this.brush_size);
      }
      context.stroke();
      context.strokeStyle = "#FFF";
      context.lineWidth = 3;
      context.stroke();
    }
    if (this.tile) {
      grd = context.createLinearGradient(0, 0, this.canvas.width, 0);
      grd.addColorStop(0, "rgba(0,0,0,1)");
      grd.addColorStop(.25, "rgba(0,0,0,0)");
      grd.addColorStop(.75, "rgba(0,0,0,0)");
      grd.addColorStop(1, "rgba(0,0,0,1)");
      context.fillStyle = grd;
      context.fillRect(0, 0, this.canvas.width, this.canvas.height);
      grd = context.createLinearGradient(0, 0, 0, this.canvas.height);
      grd.addColorStop(0, "rgba(0,0,0,1)");
      grd.addColorStop(.25, "rgba(0,0,0,0)");
      grd.addColorStop(.75, "rgba(0,0,0,0)");
      grd.addColorStop(1, "rgba(0,0,0,1)");
      context.fillStyle = grd;
      context.fillRect(0, 0, this.canvas.width, this.canvas.height);
      w = this.canvas.width;
      h = this.canvas.height;
      context.strokeStyle = "rgba(0,0,0,.5)";
      context.strokeRect(w * .25 + .5, h * .25 + .5, w * .5, h * .5);
      context.strokeStyle = "rgba(255,255,255,.5)";
      context.strokeRect(w * .25 - .5, h * .25 - .5, w * .5, h * .5);
    }
    if (this.hsymmetry) {
      w = this.canvas.width;
      h = this.canvas.height;
      context.fillStyle = "rgba(0,0,0,.5)";
      context.fillRect(0, h / 2 - 2, w, 4);
      context.fillStyle = "rgba(255,255,255,.5)";
      context.fillRect(0, h / 2 - 1.5, w, 3);
    }
    if (this.vsymmetry) {
      w = this.canvas.width;
      h = this.canvas.height;
      context.fillStyle = "rgba(0,0,0,.5)";
      context.fillRect(w / 2 - 2, 0, 4, h);
      context.fillStyle = "rgba(255,255,255,.5)";
      context.fillRect(w / 2 - 1.5, 0, 3, h);
    }
    if ((this.selection != null) && this.editor.tool.selectiontool) {
      context.save();
      if (this.tile) {
        context.translate(this.canvas.width * .25, this.canvas.width * .25);
      }
      context.strokeStyle = "rgba(0,0,0,.5)";
      context.lineWidth = 3;
      context.strokeRect(this.selection.x * wblock, this.selection.y * hblock, this.selection.w * wblock, this.selection.h * hblock);
      context.setLineDash([4, 4]);
      context.strokeStyle = this.floating_selection ? "#FA0" : "#FFF";
      context.lineWidth = 2;
      context.strokeRect(this.selection.x * wblock, this.selection.y * hblock, this.selection.w * wblock, this.selection.h * hblock);
      context.setLineDash([]);
      if (this.selection.w > 1 || this.selection.h > 1) {
        context.font = `${Math.max(12, wblock)}pt Ubuntu Mono`;
        context.fillStyle = "#FFF";
        context.shadowBlur = 2;
        context.shadowColor = "#000";
        context.shadowOpacity = 1;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(`${this.selection.w} x ${this.selection.h}`, (this.selection.x + this.selection.w / 2) * wblock, (this.selection.y + this.selection.h / 2) * hblock);
        context.shadowBlur = 0;
      }
      return context.restore();
    }
  }

  mouseDown(event) {
    var b, bg, c, context, fg, min, x, y;
    event.stopPropagation();
    if (!this.editable || (this.sprite == null)) {
      return;
    }
    this.mousepressed = true;
    b = this.canvas.getBoundingClientRect();
    min = Math.min(this.canvas.clientWidth, this.canvas.clientHeight);
    x = event.clientX - b.left;
    y = event.clientY - b.top;
    if (this.tile) {
      x = Math.floor(x / this.canvas.width * this.sprite.width * 2);
      y = Math.floor(y / this.canvas.height * this.sprite.height * 2);
      x = Math.floor((x + this.sprite.width / 2) % this.sprite.width);
      y = Math.floor((y + this.sprite.height / 2) % this.sprite.height);
    } else {
      x = Math.floor(x / this.canvas.width * this.sprite.width);
      y = Math.floor(y / this.canvas.height * this.sprite.height);
    }
    if (this.space_pressed) {
      this.grab_x = event.clientX;
      this.grab_y = event.clientY;
      this.grabbing = true;
      return;
    }
    if (this.colorpicker && !this.editor.tool.selectiontool) {
      c = this.getFrame().getRGB(x, y);
      this.editor.colorpicker.colorPicked(c);
      this.mousepressed = false;
      if (!this.editor.alt_pressed) {
        this.editor.setColorPicker(false);
      }
      return;
    }
    if (this.editor.tool.selectiontool) {
      if ((this.selection != null) && x >= this.selection.x && y >= this.selection.y && x < this.selection.x + this.selection.w && y < this.selection.y + this.selection.h) {
        if ((this.floating_selection == null) && (event.shiftKey || event.altKey)) {
          bg = document.createElement("canvas");
          bg.width = this.getFrame().canvas.width;
          bg.height = this.getFrame().canvas.height;
          context = bg.getContext("2d");
          context.drawImage(this.getFrame().canvas, 0, 0);
          if (!event.altKey) {
            context.clearRect(this.selection.x, this.selection.y, this.selection.w, this.selection.h);
          }
          fg = document.createElement("canvas");
          fg.width = this.selection.w;
          fg.height = this.selection.h;
          context = fg.getContext("2d");
          context.drawImage(this.getFrame().canvas, -this.selection.x, -this.selection.y);
          this.floating_selection = {
            bg: bg,
            fg: fg
          };
        } else if (event.altKey) {
          this.floating_selection.bg.getContext("2d").drawImage(this.floating_selection.fg, this.selection.x, this.selection.y);
        }
        this.moving_selection = true;
        this.moved_once = false;
        this.moving_start_x = x;
        this.moving_start_y = y;
        this.update();
        return;
      } else {
        this.floating_selection = null;
        this.selection_start_x = x;
        this.selection_start_y = y;
        this.selection_moved = false;
        this.selection = {
          x: x,
          y: y,
          w: 1,
          h: 1
        };
      }
      this.update();
      return;
    }
    if (this.sprite.undo == null) {
      this.sprite.undo = new Undo();
    }
    if (this.sprite.undo.empty()) {
      this.sprite.undo.pushState(this.sprite.clone());
    }
    if (this.editor.tool.parameters["Color"] != null) {
      this.editor.tool.parameters["Color"].value = this.color;
    }
    this.editor.tool.tile = this.tile;
    this.editor.tool.vsymmetry = this.vsymmetry;
    this.editor.tool.hsymmetry = this.hsymmetry;
    this.editor.tool.start(this.getFrame(), x, y, event.button, event.shiftKey);
    this.pixels_drawn += 1;
    this.mouse_x = x;
    this.mouse_y = y;
    this.update();
    this.editor.spriteChanged();
    return this.floating_selection = null;
  }

  mouseEnter(event) {
    return document.getElementById("spriteeditor").focus();
  }

  mouseMove(event) {
    var b, context, dx, dy, min, view, x, y;
    if (this.grabbing) {
      dx = event.clientX - this.grab_x;
      dy = event.clientY - this.grab_y;
      this.grab_x = event.clientX;
      this.grab_y = event.clientY;
      view = document.getElementById("spriteeditor");
      view.scrollTo(view.scrollLeft - dx, view.scrollTop - dy);
      return;
    }
    if (!this.editable) {
      return;
    }
    b = this.canvas.getBoundingClientRect();
    min = Math.min(this.canvas.clientWidth, this.canvas.clientHeight);
    x = event.clientX - b.left;
    y = event.clientY - b.top;
    if (x >= 0 && y >= 0 && x < b.right - b.left && y < b.bottom - b.top) {
      this.show_brush_size = 0;
    }
    if (this.tile) {
      x = Math.floor(x / this.canvas.width * this.sprite.width * 2);
      y = Math.floor(y / this.canvas.height * this.sprite.height * 2);
      if (!this.mousepressed && (x < 0 || y < 0 || x >= this.sprite.width * 2 || y >= this.sprite.height * 2)) {
        return;
      }
    } else {
      x = Math.floor(x / this.canvas.width * this.sprite.width);
      y = Math.floor(y / this.canvas.height * this.sprite.height);
      if (!this.mousepressed && (x < 0 || y < 0 || x >= this.sprite.width || y >= this.sprite.height)) {
        return;
      }
    }
    if (this.mousepressed && this.moving_selection) {
      if (this.floating_selection != null) {
        if (x !== this.mouse_x || y !== this.mouse_y) {
          if (!this.moved_once) {
            this.moved_once = true;
            if (this.sprite.undo == null) {
              this.sprite.undo = new Undo();
            }
            if (this.sprite.undo.empty()) {
              this.sprite.undo.pushState(this.sprite.clone());
            }
          }
          this.selection.x += x - this.mouse_x;
          this.selection.y += y - this.mouse_y;
          this.mouse_x = x;
          this.mouse_y = y;
          this.editor.setCoordinates(x, y);
          context = this.getFrame().getContext();
          context.clearRect(0, 0, this.getFrame().canvas.width, this.getFrame().canvas.height);
          context.drawImage(this.floating_selection.bg, 0, 0);
          context.drawImage(this.floating_selection.fg, this.selection.x, this.selection.y);
          this.editor.spriteChanged();
          this.update();
        }
      } else {
        this.selection.x += x - this.mouse_x;
        this.selection.y += y - this.mouse_y;
        this.selection.x = Math.max(0, Math.min(this.sprite.width - this.selection.w, this.selection.x));
        this.selection.y = Math.max(0, Math.min(this.sprite.height - this.selection.h, this.selection.y));
        this.mouse_x = x;
        this.mouse_y = y;
        this.editor.setCoordinates(x, y);
        this.update();
      }
      return;
    }
    this.mouse_over = true;
    if (this.mousepressed && this.editor.tool.selectiontool) {
      this.selection_moved = true;
    }
    if (x !== this.mouse_x || y !== this.mouse_y) {
      this.mouse_x = x;
      this.mouse_y = y;
      this.editor.setCoordinates(x, y);
      if (this.mousepressed) {
        if (this.tile) {
          x = Math.floor((x + this.sprite.width / 2) % this.sprite.width);
          y = Math.floor((y + this.sprite.height / 2) % this.sprite.height);
        }
        if (this.editor.tool.selectiontool && this.selection) {
          this.selection.x = Math.max(0, Math.min(this.selection_start_x, x));
          this.selection.y = Math.max(0, Math.min(this.selection_start_y, y));
          this.selection.w = Math.min(this.sprite.width - this.selection.x, Math.max(this.selection_start_x, x) - Math.min(this.selection_start_x, Math.max(0, x)) + 1);
          this.selection.h = Math.min(this.sprite.height - this.selection.y, Math.max(this.selection_start_y, y) - Math.min(this.selection_start_y, Math.max(0, y)) + 1);
          this.update();
          return;
        }
        this.editor.tool.move(this.getFrame(), x, y, event.buttons);
        this.pixels_drawn += 1;
        this.update();
        this.editor.spriteChanged();
      } else {
        if ((this.selection != null) && this.editor.tool.selectiontool && x >= this.selection.x && y >= this.selection.y && x < this.selection.x + this.selection.w && y < this.selection.y + this.selection.h) {
          this.canvas.style.cursor = "move";
        } else if (this.colorpicker && !this.editor.tool.selectiontool) {
          this.canvas.style.cursor = "url( '/img/eyedropper.svg' ) 0 24, pointer";
        } else {
          this.canvas.style.cursor = "crosshair";
        }
        this.update();
      }
    }
    return false;
  }

  mouseUp(event) {
    if (this.grabbing) {
      this.grabbing = false;
    } else if (this.mousepressed && !this.editor.tool.selectiontool) {
      this.sprite.undo.pushState(this.sprite.clone());
    }
    if (this.editor.tool.selectiontool && !this.selection_moved) {
      this.selection = null;
      this.update();
    }
    if (this.moving_selection) {
      this.moving_selection = false;
      if (this.moved_once && (this.floating_selection != null)) {
        this.sprite.undo.pushState(this.sprite.clone());
      }
      this.moved_once = false;
    }
    this.mousepressed = false;
    return this.editor.updateSelectionHints();
  }

  mouseOut(event) {
    this.mouse_over = false;
    this.update();
    return this.editor.setCoordinates(-1, -1);
  }

  flipSprite(direction) {
    var bg, context, fg;
    if (this.editor.tool.selectiontool) {
      if (this.selection != null) {
        if (this.sprite.undo == null) {
          this.sprite.undo = new Undo();
        }
        if (this.sprite.undo.empty()) {
          this.sprite.undo.pushState(this.sprite.clone());
        }
        fg = document.createElement("canvas");
        fg.width = this.selection.w;
        fg.height = this.selection.h;
        context = fg.getContext("2d");
        if (direction === "horizontal") {
          context.translate(this.selection.w, 0);
          context.scale(-1, 1);
        } else {
          context.translate(0, this.selection.h);
          context.scale(1, -1);
        }
        if (this.floating_selection == null) {
          context.drawImage(this.getFrame().canvas, -this.selection.x, -this.selection.y);
          context = this.getFrame().canvas.getContext("2d");
          context.clearRect(this.selection.x, this.selection.y, this.selection.w, this.selection.h);
          bg = document.createElement("canvas");
          bg.width = this.getFrame().canvas.width;
          bg.height = this.getFrame().canvas.height;
          bg.getContext("2d").drawImage(this.getFrame().canvas, 0, 0);
          context.drawImage(fg, this.selection.x, this.selection.y);
          this.floating_selection = {
            bg: bg,
            fg: fg
          };
        } else {
          context.drawImage(this.floating_selection.fg, 0, 0);
          this.floating_selection.fg = fg;
          context = this.getFrame().getContext();
          context.clearRect(0, 0, this.getFrame().canvas.width, this.getFrame().canvas.height);
          context.drawImage(this.floating_selection.bg, 0, 0);
          context.drawImage(this.floating_selection.fg, this.selection.x, this.selection.y);
        }
        this.sprite.undo.pushState(this.sprite.clone());
        this.update();
        return this.editor.spriteChanged();
      }
    }
  }

  rotateSprite(direction) {
    var bg, context, cx, cy, fg, nh, nw, nx, ny;
    if (this.editor.tool.selectiontool) {
      if (this.selection != null) {
        if (this.sprite.undo == null) {
          this.sprite.undo = new Undo();
        }
        if (this.sprite.undo.empty()) {
          this.sprite.undo.pushState(this.sprite.clone());
        }
        fg = document.createElement("canvas");
        fg.width = this.selection.h;
        fg.height = this.selection.w;
        context = fg.getContext("2d");
        context.translate(fg.width / 2, fg.height / 2);
        context.rotate(direction * Math.PI / 2);
        cx = this.selection.x + this.selection.w / 2;
        cy = this.selection.y + this.selection.h / 2;
        nw = this.selection.h;
        nh = this.selection.w;
        nx = Math.round(cx - nw / 2 + .01 * direction);
        ny = Math.round(cy - nh / 2 + .01 * direction);
        if (this.floating_selection == null) {
          context.drawImage(this.getFrame().canvas, -this.selection.x - this.selection.w / 2, -this.selection.y - this.selection.h / 2);
          context = this.getFrame().canvas.getContext("2d");
          context.clearRect(this.selection.x, this.selection.y, this.selection.w, this.selection.h);
          bg = document.createElement("canvas");
          bg.width = this.getFrame().canvas.width;
          bg.height = this.getFrame().canvas.height;
          bg.getContext("2d").drawImage(this.getFrame().canvas, 0, 0);
          context.drawImage(fg, nx, ny);
          this.selection.x = nx;
          this.selection.y = ny;
          this.selection.w = nw;
          this.selection.h = nh;
          this.floating_selection = {
            bg: bg,
            fg: fg
          };
        } else {
          context.drawImage(this.floating_selection.fg, -this.floating_selection.fg.width / 2, -this.floating_selection.fg.height / 2);
          this.floating_selection.fg = fg;
          this.selection.x = nx;
          this.selection.y = ny;
          this.selection.w = nw;
          this.selection.h = nh;
          context = this.getFrame().getContext();
          context.clearRect(0, 0, this.getFrame().canvas.width, this.getFrame().canvas.height);
          context.drawImage(this.floating_selection.bg, 0, 0);
          context.drawImage(this.floating_selection.fg, this.selection.x, this.selection.y);
        }
        this.sprite.undo.pushState(this.sprite.clone());
        this.update();
        return this.editor.spriteChanged();
      }
    }
  }

};

this.AnimationPanel = (function() {
  function AnimationPanel(sprite_editor) {
    this.sprite_editor = sprite_editor;
    this.panel_shown = false;
    this.animation_preview = new AnimationPreview(this.sprite_editor);
    document.querySelector("#sprite-animation-title").addEventListener("click", (function(_this) {
      return function() {
        return _this.togglePanel();
      };
    })(this));
    document.querySelector("#add-frame-button").addEventListener("click", (function(_this) {
      return function() {
        _this.addFrame();
        return document.querySelector("#add-frame-button").scrollIntoView();
      };
    })(this));
  }

  AnimationPanel.prototype.hidePanel = function() {
    this.panel_shown = false;
    document.querySelector("#sprite-animation-title").classList.add("collapsed");
    document.querySelector("#sprite-animation-panel").classList.add("collapsed");
    document.querySelector("#sprite-animation-title i").classList.add("fa-caret-right");
    document.querySelector("#sprite-animation-title i").classList.remove("fa-caret-down");
    document.querySelector("#spriteeditorcontainer").classList.add("expanded");
    return this.sprite_editor.spriteview.windowResized();
  };

  AnimationPanel.prototype.showPanel = function() {
    if (this.sprite_editor.selected_sprite === "icon") {
      return;
    }
    this.panel_shown = true;
    document.querySelector("#sprite-animation-title").classList.remove("collapsed");
    document.querySelector("#sprite-animation-panel").classList.remove("collapsed");
    document.querySelector("#sprite-animation-title i").classList.remove("fa-caret-right");
    document.querySelector("#sprite-animation-title i").classList.add("fa-caret-down");
    document.querySelector("#spriteeditorcontainer").classList.remove("expanded");
    return this.sprite_editor.spriteview.windowResized();
  };

  AnimationPanel.prototype.togglePanel = function() {
    if (this.panel_shown) {
      return this.hidePanel();
    } else {
      return this.showPanel();
    }
  };

  AnimationPanel.prototype.spriteChanged = function() {
    if (this.sprite_editor.selected_sprite === "icon" || (this.sprite_editor.selected_sprite == null)) {
      document.querySelector("#sprite-animation-title").style.display = "none";
      this.hidePanel();
    } else {
      document.querySelector("#sprite-animation-title").style.display = "block";
      if (this.sprite_editor.spriteview.sprite.frames.length > 1) {
        this.showPanel();
      } else {
        this.hidePanel();
      }
      this.animation_preview.fps = this.sprite_editor.spriteview.sprite.fps;
      this.animation_preview.setSlider();
    }
    return this.updateFrames();
  };

  AnimationPanel.prototype.addFrame = function() {
    var sprite;
    sprite = this.sprite_editor.spriteview.sprite;
    if (sprite.undo == null) {
      sprite.undo = new Undo();
    }
    if (sprite.undo.empty()) {
      sprite.undo.pushState(sprite.clone());
    }
    this.sprite_editor.spriteview.sprite.addFrame();
    this.updateFrames();
    this.sprite_editor.spriteview.setCurrentFrame(this.sprite_editor.spriteview.sprite.frames.length - 1);
    this.sprite_editor.spriteview.update();
    this.updateSelection();
    return sprite.undo.pushState(sprite.clone());
  };

  AnimationPanel.prototype.updateFrames = function() {
    var frame, i, j, len, list, ref, s;
    s = this.sprite_editor.spriteview.sprite;
    list = document.querySelector("#sprite-animation-list");
    list.innerHTML = "";
    this.frames = [];
    ref = s.frames;
    for (i = j = 0, len = ref.length; j < len; i = ++j) {
      frame = ref[i];
      list.appendChild(this.createFrameView(frame, i));
    }
  };

  AnimationPanel.prototype.updateSelection = function() {
    var c, i, j, len, ref, results;
    ref = document.getElementById("sprite-animation-list").children;
    results = [];
    for (i = j = 0, len = ref.length; j < len; i = ++j) {
      c = ref[i];
      if (i === this.sprite_editor.spriteview.sprite.current_frame) {
        results.push(c.classList.add("selected"));
      } else {
        results.push(c.classList.remove("selected"));
      }
    }
    return results;
  };

  AnimationPanel.prototype.createFrameView = function(frame, index) {
    var canvas, context, div, h, r, span, w;
    div = document.createElement("div");
    div.classList.add("sprite-animation-frame");
    if (index === this.sprite_editor.spriteview.sprite.current_frame) {
      div.classList.add("selected");
    }
    canvas = document.createElement("canvas");
    canvas.width = 80;
    canvas.height = 80;
    context = canvas.getContext("2d");
    context.imageSmoothingEnabled = false;
    r = Math.min(80 / frame.width, 80 / frame.height);
    w = r * frame.width;
    h = r * frame.height;
    context.drawImage(frame.getCanvas(), 40 - w / 2, 40 - h / 2, w, h);
    div.appendChild(canvas);
    canvas.addEventListener("click", (function(_this) {
      return function() {
        return _this.doFrameOption(index, "select");
      };
    })(this));
    div.appendChild(this.createFrameOption("clone", "clone", "Duplicate Frame", index));
    if (this.sprite_editor.spriteview.sprite.frames.length > 1) {
      div.appendChild(this.createFrameOption("remove", "times", "Delete Frame", index));
    }
    div.appendChild(this.createFrameOption("moveleft", "arrow-left", "Move Left", index));
    div.appendChild(this.createFrameOption("moveright", "arrow-right", "Move Right", index));
    span = document.createElement("span");
    span.innerHTML = "" + index;
    div.appendChild(span);
    this.frames[index] = canvas;
    return div;
  };

  AnimationPanel.prototype.createFrameOption = function(option, icon, text, index) {
    var i;
    i = document.createElement("i");
    i.classList.add(option);
    i.classList.add("fa");
    i.classList.add("fa-" + icon);
    i.title = this.sprite_editor.app.translator.get(text);
    i.addEventListener("click", (function(_this) {
      return function() {
        return _this.doFrameOption(index, option);
      };
    })(this));
    return i;
  };

  AnimationPanel.prototype.doFrameOption = function(index, option) {
    var f, frame, sprite;
    switch (option) {
      case "select":
        this.sprite_editor.spriteview.setCurrentFrame(index);
        this.sprite_editor.spriteview.update();
        return this.updateSelection();
      case "clone":
        sprite = this.sprite_editor.spriteview.sprite;
        if (sprite.undo == null) {
          sprite.undo = new Undo();
        }
        if (sprite.undo.empty()) {
          sprite.undo.pushState(sprite.clone());
        }
        f = this.sprite_editor.spriteview.sprite.frames[index];
        frame = f.clone();
        this.sprite_editor.spriteview.sprite.frames.splice(index, 0, frame);
        this.updateFrames();
        this.doFrameOption(index + 1, "select");
        this.sprite_editor.spriteChanged();
        return sprite.undo.pushState(sprite.clone());
      case "remove":
        if (this.sprite_editor.spriteview.sprite.frames.length > 1) {
          sprite = this.sprite_editor.spriteview.sprite;
          if (sprite.undo == null) {
            sprite.undo = new Undo();
          }
          if (sprite.undo.empty()) {
            sprite.undo.pushState(sprite.clone());
          }
          this.sprite_editor.spriteview.sprite.frames.splice(index, 1);
          this.updateFrames();
          this.doFrameOption(Math.max(0, index - 1), "select");
          this.sprite_editor.spriteChanged();
          return sprite.undo.pushState(sprite.clone());
        }
        break;
      case "moveleft":
        if (index > 0) {
          sprite = this.sprite_editor.spriteview.sprite;
          if (sprite.undo == null) {
            sprite.undo = new Undo();
          }
          if (sprite.undo.empty()) {
            sprite.undo.pushState(sprite.clone());
          }
          frame = this.sprite_editor.spriteview.sprite.frames.splice(index, 1)[0];
          this.sprite_editor.spriteview.sprite.frames.splice(index - 1, 0, frame);
          this.updateFrames();
          this.doFrameOption(index - 1, "select");
          this.sprite_editor.spriteChanged();
          return sprite.undo.pushState(sprite.clone());
        }
        break;
      case "moveright":
        if (index < this.sprite_editor.spriteview.sprite.frames.length - 1) {
          sprite = this.sprite_editor.spriteview.sprite;
          if (sprite.undo == null) {
            sprite.undo = new Undo();
          }
          if (sprite.undo.empty()) {
            sprite.undo.pushState(sprite.clone());
          }
          frame = this.sprite_editor.spriteview.sprite.frames.splice(index, 1)[0];
          this.sprite_editor.spriteview.sprite.frames.splice(index + 1, 0, frame);
          this.updateFrames();
          this.doFrameOption(index + 1, "select");
          this.sprite_editor.spriteChanged();
          return sprite.undo.pushState(sprite.clone());
        }
    }
  };

  AnimationPanel.prototype.frameUpdated = function() {
    var context, frame, h, index, j, r, ref, results, w;
    results = [];
    for (index = j = 0, ref = this.frames.length - 1; j <= ref; index = j += 1) {
      context = this.frames[index].getContext("2d");
      context.clearRect(0, 0, 80, 80);
      frame = this.sprite_editor.spriteview.sprite.frames[index];
      if (frame != null) {
        r = Math.min(80 / frame.width, 80 / frame.height);
        w = r * frame.width;
        h = r * frame.height;
        results.push(context.drawImage(frame.getCanvas(), 40 - w / 2, 40 - h / 2, w, h));
      } else {
        results.push(void 0);
      }
    }
    return results;
  };

  return AnimationPanel;

})();

this.AnimationPreview = (function() {
  function AnimationPreview(sprite_editor) {
    this.sprite_editor = sprite_editor;
    this.canvas = document.querySelector("#sprite-animation-preview canvas");
    this.context = this.canvas.getContext("2d");
    this.context.imageSmoothingEnabled = false;
    this.frame = 0;
    this.last = Date.now();
    this.fps = 5;
    this.timer();
    this.input = document.querySelector("#sprite-animation-preview input");
    this.input.addEventListener("input", (function(_this) {
      return function() {
        _this.fps = 1 + Math.round(Math.pow(_this.input.value / 100, 2) * 59);
        _this.sprite_editor.spriteview.sprite.fps = _this.fps;
        _this.sprite_editor.spriteChanged();
        return _this.last = 0;
      };
    })(this));
    this.input.addEventListener("mouseenter", (function(_this) {
      return function() {
        _this.fps_change = true;
        return _this.last = 0;
      };
    })(this));
    this.input.addEventListener("mouseout", (function(_this) {
      return function() {
        _this.fps_change = false;
        return _this.last = 0;
      };
    })(this));
    this.setSlider();
  }

  AnimationPreview.prototype.setSlider = function() {
    return this.input.value = Math.pow((this.fps - 1) / 59, 1 / 2) * 100;
  };

  AnimationPreview.prototype.timer = function() {
    requestAnimationFrame((function(_this) {
      return function() {
        return _this.timer();
      };
    })(this));
    return this.update();
  };

  AnimationPreview.prototype.update = function() {
    var frame, h, r, time, w;
    if (this.sprite_editor.spriteview.sprite != null) {
      time = Date.now();
      if (time > this.last + 1000 / this.fps) {
        this.last += 1000 / this.fps;
        if (this.last < time - 1000) {
          this.last = time;
        }
        this.frame = (this.frame + 1) % this.sprite_editor.spriteview.sprite.frames.length;
        frame = this.sprite_editor.spriteview.sprite.frames[this.frame];
        r = Math.min(80 / frame.width, 80 / frame.height);
        w = r * frame.width;
        h = r * frame.height;
        this.context.clearRect(0, 0, 80, 80);
        this.context.drawImage(frame.getCanvas(), 40 - w / 2, 40 - h / 2, w, h);
        if (this.fps_change) {
          this.context.font = "12pt Ubuntu Mono";
          this.context.shadowBlur = 2;
          this.context.shadowOpacity = 1;
          this.context.shadowColor = "#000";
          this.context.fillStyle = "#FFF";
          this.context.textAlign = "center";
          this.context.textBaseline = "middle";
          this.context.fillText(this.fps + " FPS", 40, 70);
          this.context.shadowBlur = 0;
          return this.context.shadowOpacity = 0;
        }
      }
    }
  };

  return AnimationPreview;

})();

this.AutoPalette = (function() {
  function AutoPalette(spriteeditor) {
    this.spriteeditor = spriteeditor;
    this.locked = false;
    this.lock = document.getElementById("auto-palette-lock");
    this.list = document.getElementById("auto-palette-list");
    setInterval(((function(_this) {
      return function() {
        return _this.process();
      };
    })(this)), 16);
    this.palette = {};
    this.lock.addEventListener("click", (function(_this) {
      return function() {
        if (_this.locked) {
          _this.locked = false;
          _this.lock.classList.remove("locked");
          _this.lock.classList.remove("fa-lock");
          _this.lock.classList.add("fa-lock-open");
          return _this.lock.title = _this.spriteeditor.app.translator.get("Lock palette");
        } else {
          _this.locked = true;
          _this.lock.classList.add("locked");
          _this.lock.classList.add("fa-lock");
          _this.lock.classList.remove("fa-lock-open");
          return _this.lock.title = _this.spriteeditor.app.translator.get("Unlock palette");
        }
      };
    })(this));
  }

  AutoPalette.prototype.update = function() {
    this.current_sprite = this.spriteeditor.spriteview.sprite;
    this.current_frame = 0;
    this.current_line = 0;
    return this.colors = {};
  };

  AutoPalette.prototype.setColor = function(col) {
    var c;
    c = [col.color >> 16, (col.color >> 8) & 0xFF, col.color & 0xFF];
    return this.spriteeditor.colorpicker.colorPicked(c);
  };

  AutoPalette.prototype.colorPicked = function(color) {
    var c, j, len, ref;
    ref = this.list.childNodes;
    for (j = 0, len = ref.length; j < len; j++) {
      c = ref[j];
      if (c === this.palette[color]) {
        c.classList.add("selected");
      } else {
        c.classList.remove("selected");
      }
    }
  };

  AutoPalette.prototype.process = function() {
    var c, col, data, fn, frame, i, j, k, key, len, ref, ref1, score, time, value;
    if (this.locked) {
      return;
    }
    if (!this.current_sprite) {
      return;
    }
    if (this.current_frame >= this.current_sprite.frames.length) {
      c = [];
      ref = this.colors;
      for (key in ref) {
        value = ref[key];
        c.push({
          color: value.color,
          count: value.count,
          hsl: this.rgbToHsl(value.color)
        });
      }
      if (c.length > 32) {
        c.sort(function(a, b) {
          return b.count - a.count;
        });
        c.splice(32, c.length - 31);
      }
      this.current_sprite = null;
      score = function(col) {
        return Math.round(col.hsl[0] * 16) / 16 * 100 + col.hsl[2] + (col.hsl[1] < .1 || col.hsl[2] > .9 ? -1000 : 0);
      };
      c.sort(function(a, b) {
        return score(a) - score(b);
      });
      this.list.innerHTML = "";
      this.palette = {};
      fn = (function(_this) {
        return function(col) {
          var div, rgb;
          div = document.createElement("div");
          rgb = "rgb(" + (col.color >> 16) + "," + ((col.color >> 8) & 0xFF) + "," + (col.color & 0xFF) + ")";
          div.style.background = rgb;
          div.addEventListener("click", function() {
            return _this.setColor(col);
          });
          _this.list.appendChild(div);
          return _this.palette[rgb] = div;
        };
      })(this);
      for (j = 0, len = c.length; j < len; j++) {
        col = c[j];
        fn(col);
      }
    } else {
      time = Date.now();
      while (Date.now() < time + 2 && this.current_frame < this.current_sprite.frames.length) {
        frame = this.current_sprite.frames[this.current_frame];
        if (frame == null) {
          return;
        }
        if (this.current_line < frame.getCanvas().height) {
          data = frame.getContext().getImageData(0, this.current_line, frame.width, 1);
          for (i = k = 0, ref1 = frame.width - 1; k <= ref1; i = k += 1) {
            if (data.data[i * 4 + 3] < 128) {
              continue;
            }
            col = (Math.floor(data.data[i * 4] / 16) << 8) + (Math.floor(data.data[i * 4 + 1] / 16) << 4) + Math.floor(data.data[i * 4 + 2] / 16);
            if (this.colors[col] == null) {
              this.colors[col] = {
                color: (data.data[i * 4] << 16) + (data.data[i * 4 + 1] << 8) + data.data[i * 4 + 2],
                count: 1
              };
            } else {
              this.colors[col].count += 1;
            }
          }
          this.current_line += 1;
        } else {
          this.current_line = 0;
          this.current_frame += 1;
        }
      }
    }
  };

  AutoPalette.prototype.rgbToHsl = function(c) {
    var b, d, g, h, l, max, min, r, s;
    r = (c >> 16) / 255;
    g = ((c >> 8) & 0xFF) / 255;
    b = (c & 0xFF) / 255;
    max = Math.max(r, g, b);
    min = Math.min(r, g, b);
    l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
      }
      h /= 6;
    }
    return [h, s, l];
  };

  return AutoPalette;

})();

this.Sprite = (function() {
  function Sprite(width, height1, properties) {
    var img;
    this.width = width;
    this.height = height1;
    this.name = "";
    this.frames = [];
    if ((this.width != null) && typeof this.width === "string") {
      this.ready = false;
      img = new Image;
      if (location.protocol !== "file:") {
        img.crossOrigin = "Anonymous";
      }
      img.src = this.width;
      this.width = 0;
      this.height = 0;
      img.onload = (function(_this) {
        return function() {
          _this.ready = true;
          return _this.load(img, properties);
        };
      })(this);
      img.onerror = (function(_this) {
        return function() {
          return _this.ready = true;
        };
      })(this);
    } else {
      this.frames.push(new SpriteFrame(this, this.width, this.height));
      this.ready = true;
    }
    this.current_frame = 0;
    this.animation_start = 0;
    this.fps = properties ? properties.fps || 5 : 5;
  }

  Sprite.prototype.setFrame = function(f) {
    return this.animation_start = Date.now() - 1000 / this.fps * f;
  };

  Sprite.prototype.getFrame = function() {
    var dt;
    dt = 1000 / this.fps;
    return Math.floor((Date.now() - this.animation_start) / dt) % this.frames.length;
  };

  Sprite.prototype.cutFrames = function(num) {
    var frame, height, i, j, ref;
    height = Math.round(this.height / num);
    for (i = j = 0, ref = num - 1; 0 <= ref ? j <= ref : j >= ref; i = 0 <= ref ? ++j : --j) {
      frame = new Sprite(this.width, height);
      frame.getContext().drawImage(this.getCanvas(), 0, -i * height);
      this.frames[i] = frame;
    }
    this.height = height;
    return this.canvas = this.frames[0].canvas;
  };

  Sprite.prototype.saveData = function() {
    var canvas, context, i, j, ref;
    if (this.frames.length > 1) {
      canvas = document.createElement("canvas");
      canvas.width = this.width;
      canvas.height = this.height * this.frames.length;
      context = canvas.getContext("2d");
      for (i = j = 0, ref = this.frames.length - 1; 0 <= ref ? j <= ref : j >= ref; i = 0 <= ref ? ++j : --j) {
        context.drawImage(this.frames[i].getCanvas(), 0, this.height * i);
      }
      return canvas.toDataURL();
    } else {
      return this.frames[0].getCanvas().toDataURL();
    }
  };

  Sprite.prototype.loaded = function() {};

  Sprite.prototype.setCurrentFrame = function(index) {
    if (index >= 0 && index < this.frames.length) {
      return this.current_frame = index;
    }
  };

  Sprite.prototype.clone = function() {
    var sprite;
    sprite = new Sprite(this.width, this.height);
    sprite.copyFrom(this);
    return sprite;
  };

  Sprite.prototype.resize = function(width, height1) {
    var f, j, len, ref;
    this.width = width;
    this.height = height1;
    ref = this.frames;
    for (j = 0, len = ref.length; j < len; j++) {
      f = ref[j];
      f.resize(this.width, this.height);
    }
  };

  Sprite.prototype.load = function(img, properties) {
    var frame, i, j, numframes, ref;
    if (img.width > 0 && img.height > 0) {
      numframes = 1;
      if ((properties != null) && (properties.frames != null)) {
        numframes = properties.frames;
      }
      this.width = img.width;
      this.height = Math.round(img.height / numframes);
      this.frames = [];
      for (i = j = 0, ref = numframes - 1; 0 <= ref ? j <= ref : j >= ref; i = 0 <= ref ? ++j : --j) {
        frame = new SpriteFrame(this, this.width, this.height);
        frame.getContext().drawImage(img, 0, -i * this.height);
        this.frames.push(frame);
      }
      this.ready = true;
    }
    return this.loaded();
  };

  Sprite.prototype.copyFrom = function(sprite) {
    var f, j, len, ref;
    this.width = sprite.width;
    this.height = sprite.height;
    this.frames = [];
    ref = sprite.frames;
    for (j = 0, len = ref.length; j < len; j++) {
      f = ref[j];
      this.frames.push(f.clone());
    }
    this.current_frame = sprite.current_frame;
  };

  Sprite.prototype.clear = function() {
    var f, j, len, ref;
    ref = this.frames;
    for (j = 0, len = ref.length; j < len; j++) {
      f = ref[j];
      f.clear();
    }
  };

  Sprite.prototype.addFrame = function() {
    return this.frames.push(new SpriteFrame(this, this.width, this.height));
  };

  Sprite.prototype.flipH = function() {
    var cc, data, f, j, k, l, len, oc, ref, ref1, ref2, xx, yy;
    ref = this.frames;
    for (j = 0, len = ref.length; j < len; j++) {
      f = ref[j];
      cc = f.clone().getContext();
      oc = f.getContext();
      for (xx = k = 0, ref1 = f.width - 1; 0 <= ref1 ? k <= ref1 : k >= ref1; xx = 0 <= ref1 ? ++k : --k) {
        for (yy = l = 0, ref2 = f.height - 1; 0 <= ref2 ? l <= ref2 : l >= ref2; yy = 0 <= ref2 ? ++l : --l) {
          data = cc.getImageData(xx, yy, 1, 1);
          oc.putImageData(data, f.width - xx - 1, yy);
        }
      }
    }
  };

  Sprite.prototype.flipV = function() {
    var cc, data, f, j, k, l, len, oc, ref, ref1, ref2, xx, yy;
    ref = this.frames;
    for (j = 0, len = ref.length; j < len; j++) {
      f = ref[j];
      cc = f.clone().getContext();
      oc = f.getContext();
      for (xx = k = 0, ref1 = f.width - 1; 0 <= ref1 ? k <= ref1 : k >= ref1; xx = 0 <= ref1 ? ++k : --k) {
        for (yy = l = 0, ref2 = f.height - 1; 0 <= ref2 ? l <= ref2 : l >= ref2; yy = 0 <= ref2 ? ++l : --l) {
          data = cc.getImageData(xx, yy, 1, 1);
          oc.putImageData(data, xx, f.height - yy - 1);
        }
      }
    }
  };

  return Sprite;

})();

this.SpriteFrame = class SpriteFrame {
  constructor(sprite, width, height) {
    this.sprite = sprite;
    this.width = width;
    this.height = height;
    this.name = "";
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  clone() {
    var sf;
    sf = new SpriteFrame(this.sprite, this.width, this.height);
    sf.getContext().drawImage(this.canvas, 0, 0);
    return sf;
  }

  getContext() {
    if (this.canvas == null) {
      return null;
    }
    return this.context = this.getCanvas().getContext("2d");
  }

  getCanvas() {
    var c;
    if (this.canvas == null) {
      return null;
    }
    if (!(this.canvas instanceof HTMLCanvasElement)) {
      c = document.createElement("canvas");
      c.width = this.canvas.width;
      c.height = this.canvas.height;
      c.getContext("2d").drawImage(this.canvas, 0, 0);
      this.canvas = c;
    }
    return this.canvas;
  }

  setPixel(x, y, color, alpha = 1) {
    var c;
    c = this.getContext();
    c.globalAlpha = alpha;
    c.fillStyle = color;
    c.fillRect(x, y, 1, 1);
    return c.globalAlpha = 1;
  }

  erasePixel(x, y, alpha = 1) {
    var c, data;
    c = this.getContext();
    data = c.getImageData(x, y, 1, 1);
    data.data[3] *= 1 - alpha;
    return c.putImageData(data, x, y);
  }

  getRGB(x, y) {
    var c, data;
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return [0, 0, 0];
    }
    c = this.getContext();
    data = c.getImageData(x, y, 1, 1);
    return data.data;
  }

  clear() {
    return this.getContext().clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  resize(w, h) {
    var c;
    if (w === this.width && h === this.height) {
      return;
    }
    c = new PixelArtScaler().rescale(this.canvas, w, h);
    this.canvas = c;
    this.context = null;
    this.width = w;
    return this.height = h;
  }

  load(img) {
    this.resize(img.width, img.height);
    this.clear();
    return this.canvas.getContext("2d").drawImage(img, 0, 0);
  }

  copyFrom(frame) {
    this.resize(frame.width, frame.height);
    this.clear();
    return this.getContext().drawImage(frame.canvas, 0, 0);
  }

};

this.MapView = (function() {
  function MapView(editor) {
    var _this = this;
    this.editor = editor;
    this.canvas = document.createElement("canvas");
    this.canvas.width = 400;
    this.canvas.height = 400;
    this.map = new MicroMap(24, 16, 16, 16, {});
    
    // Zoom & Pan state
    this.zoom = 1.0;
    this.pan_x = 0;
    this.pan_y = 0;
    this.base_width = 400;
    this.base_height = 400;
    this.space_pressed = false;
    this.is_panning = false;
    this.pan_start_x = 0;
    this.pan_start_y = 0;
    this.minimap_visible = true;

    // Create minimap element
    this.minimap_container = document.createElement("div");
    this.minimap_container.id = "map-minimap-container";
    this.minimap_canvas = document.createElement("canvas");
    this.minimap_canvas.id = "map-minimap";
    this.minimap_canvas.width = 160;
    this.minimap_canvas.height = 100;
    this.minimap_container.appendChild(this.minimap_canvas);

    // Append to wrapper or body when ready
    setTimeout(function() {
      var wrapper = document.getElementById("mapeditor-wrapper") || document.getElementById("mapeditor");
      if (wrapper && !document.getElementById("map-minimap-container")) {
        wrapper.appendChild(_this.minimap_container);
      }
    }, 100);

    // Minimap interaction (click & drag to pan viewport)
    this.minimap_dragging = false;
    this.minimap_canvas.addEventListener("mousedown", function(e) {
      _this.minimap_dragging = true;
      _this.panFromMinimap(e);
      e.stopPropagation();
      e.preventDefault();
    });
    window.addEventListener("mousemove", function(e) {
      if (_this.minimap_dragging) {
        _this.panFromMinimap(e);
        e.stopPropagation();
        e.preventDefault();
      }
    });
    window.addEventListener("mouseup", function(e) {
      _this.minimap_dragging = false;
    });

    // Spacebar for panning
    window.addEventListener("keydown", function(e) {
      if (e.code === "Space" && document.activeElement && document.activeElement.tagName !== "INPUT") {
        _this.space_pressed = true;
        _this.canvas.style.cursor = "grab";
      }
    });
    window.addEventListener("keyup", function(e) {
      if (e.code === "Space") {
        _this.space_pressed = false;
        _this.canvas.style.cursor = "crosshair";
      }
    });

    // Touch events
    this.canvas.addEventListener("touchstart", function(event) {
      if (event.touches != null && event.touches[0] != null) {
        event.preventDefault();
        event.touches[0].stopPropagation = function() { return event.stopPropagation(); };
        return _this.mouseDown(event.touches[0]);
      }
    });
    document.addEventListener("touchmove", function(event) {
      if (event.touches != null && event.touches[0] != null) {
        return _this.mouseMove(event.touches[0]);
      }
    });
    document.addEventListener("touchend", function() { return _this.mouseUp(); });
    this.canvas.addEventListener("touchcancel", function() { return _this.mouseOut(); });

    // Mouse events on main canvas
    this.canvas.addEventListener("mousedown", function(event) {
      return _this.mouseDown(event);
    });
    this.canvas.addEventListener("mousemove", function(event) {
      return _this.mouseMove(event);
    });
    this.canvas.addEventListener("mouseout", function(event) {
      return _this.mouseOut(event);
    });
    document.addEventListener("mouseup", function(event) {
      return _this.mouseUp(event);
    });
    this.canvas.addEventListener("contextmenu", function(event) {
      return event.preventDefault();
    });

    // Mouse Wheel Zoom
    var handleWheel = function(e) {
      e.preventDefault();
      var zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      _this.setZoom(_this.zoom * zoomFactor, e.clientX, e.clientY);
    };
    this.canvas.addEventListener("wheel", handleWheel, { passive: false });

    window.addEventListener("resize", function() {
      return _this.windowResized();
    });

    this.editable = false;
    this.sprite = "icon";
    this.cells_drawn = 0;
    this.updateLoop();
  }

  MapView.prototype.setSprite = function(sprite) {
    this.sprite = sprite;
  };

  MapView.prototype.setZoom = function(newZoom, mouseX, mouseY) {
    var oldZoom = this.zoom;
    this.zoom = Math.max(0.15, Math.min(10.0, newZoom));
    
    var c = this.canvas.parentElement;
    if (c && mouseX != null && mouseY != null) {
      var rect = c.getBoundingClientRect();
      var mx = mouseX - rect.left - c.clientWidth / 2;
      var my = mouseY - rect.top - c.clientHeight / 2;
      var scaleChange = this.zoom / oldZoom;
      this.pan_x = mx - (mx - this.pan_x) * scaleChange;
      this.pan_y = my - (my - this.pan_y) * scaleChange;
    }
    
    this.windowResized();
    this.updateZoomLabel();
    this.update();
  };

  MapView.prototype.zoomIn = function() {
    this.setZoom(this.zoom * 1.25);
  };

  MapView.prototype.zoomOut = function() {
    this.setZoom(this.zoom / 1.25);
  };

  MapView.prototype.zoomReset = function() {
    this.zoom = 1.0;
    this.pan_x = 0;
    this.pan_y = 0;
    this.windowResized();
    this.updateZoomLabel();
    this.update();
  };

  MapView.prototype.zoomFit = function() {
    this.zoom = 1.0;
    this.pan_x = 0;
    this.pan_y = 0;
    this.windowResized();
    this.updateZoomLabel();
    this.update();
  };

  MapView.prototype.toggleMinimap = function() {
    this.minimap_visible = !this.minimap_visible;
    if (this.minimap_container) {
      this.minimap_container.style.display = this.minimap_visible ? "block" : "none";
    }
    this.update();
  };

  MapView.prototype.updateZoomLabel = function() {
    var label = document.getElementById("map-zoom-label");
    if (label) {
      label.textContent = Math.round(this.zoom * 100) + "%";
    }
  };

  MapView.prototype.panFromMinimap = function(e) {
    if (!this.minimap_canvas || !this.map) return;
    var rect = this.minimap_canvas.getBoundingClientRect();
    var clickX = e.clientX - rect.left;
    var clickY = e.clientY - rect.top;
    
    var normX = clickX / this.minimap_canvas.width;
    var normY = clickY / this.minimap_canvas.height;
    
    var c = this.canvas.parentElement;
    if (!c) return;

    // Center main map view on clicked tile
    this.pan_x = (0.5 - normX) * this.canvas.width;
    this.pan_y = (0.5 - normY) * this.canvas.height;
    
    this.updateCanvasPosition();
    this.update();
  };

  MapView.prototype.updateCanvasPosition = function() {
    var c = this.canvas.parentElement;
    if (!c) return;
    var left = Math.round((c.clientWidth - this.canvas.width) / 2 + this.pan_x);
    var top = Math.round((c.clientHeight - this.canvas.height) / 2 + this.pan_y);
    this.canvas.style.position = "absolute";
    this.canvas.style.left = left + "px";
    this.canvas.style.top = top + "px";
    this.canvas.style.margin = "0px";
    this.canvas.style.display = "block";
  };

  MapView.prototype.windowResized = function() {
    var c = this.canvas.parentElement;
    var parentW = (c && c.clientWidth > 0) ? c.clientWidth : 600;
    var parentH = (c && c.clientHeight > 0) ? c.clientHeight : 400;

    var mapW = (this.map && this.map.width > 0) ? this.map.width : 16;
    var mapH = (this.map && this.map.height > 0) ? this.map.height : 10;
    var blockW = (this.map && this.map.block_width > 0) ? this.map.block_width : 16;
    var blockH = (this.map && this.map.block_height > 0) ? this.map.block_height : 16;

    var w = Math.max(80, parentW - 40);
    var h = Math.max(80, parentH - 40);
    var mapPixelW = Math.max(1, mapW * blockW);
    var mapPixelH = Math.max(1, mapH * blockH);
    var ratio = Math.min(w / mapPixelW, h / mapPixelH);
    
    this.base_width = Math.max(16, Math.floor(ratio * mapPixelW));
    this.base_height = Math.max(16, Math.floor(ratio * mapPixelH));
    
    var currentZoom = (this.zoom && this.zoom > 0) ? this.zoom : 1.0;
    var scaledW = Math.max(16, Math.floor(this.base_width * currentZoom));
    var scaledH = Math.max(16, Math.floor(this.base_height * currentZoom));
    
    if (scaledW !== this.canvas.width || scaledH !== this.canvas.height) {
      this.canvas.width = scaledW;
      this.canvas.height = scaledH;
    }
    
    this.updateCanvasPosition();
    this.update();
  };

  MapView.prototype.updateLoop = function() {
    var _this = this;
    requestAnimationFrame(function() {
      return _this.updateLoop();
    });
    if (this.needs_update) {
      this.needs_update = false;
      return this.update();
    }
  };

  MapView.prototype.update = function() {
    var c, context, hblock, i, k, l, m, n, ref, ref1, ref2, ref3, th, tw, underlay, wblock;
    context = this.canvas.getContext("2d");
    if (this.editor.background_color_picker != null) {
      c = this.editor.background_color_picker.color;
      context.fillStyle = c;
    } else {
      context.fillStyle = "#000";
    }
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    context.imageSmoothingEnabled = false;

    if (this.editor.map_underlay != null) {
      underlay = this.editor.app.project.getMap(this.editor.map_underlay);
      if (underlay != null) {
        underlay.update();
        context.globalAlpha = 0.3;
        underlay.draw(context, 0, 0, this.canvas.width, this.canvas.height);
        context.globalAlpha = 1;
      }
    }

    wblock = this.canvas.width / this.map.width;
    hblock = this.canvas.height / this.map.height;

    // Grid lines
    context.lineWidth = 1;
    context.strokeStyle = "rgba(0,0,0,.15)";
    for (i = k = 0, ref = this.map.width; 0 <= ref ? k <= ref : k >= ref; i = 0 <= ref ? ++k : --k) {
      context.beginPath();
      context.moveTo(i * wblock + 0.25, 0);
      context.lineTo(i * wblock + 0.5, this.canvas.height);
      context.stroke();
    }
    for (i = l = 0, ref1 = this.map.height; 0 <= ref1 ? l <= ref1 : l >= ref1; i = 0 <= ref1 ? ++l : --l) {
      context.beginPath();
      context.moveTo(0, i * hblock + 0.25);
      context.lineTo(this.canvas.width, i * hblock + 0.5);
      context.stroke();
    }
    context.strokeStyle = "rgba(255,255,255,.15)";
    for (i = m = 0, ref2 = this.map.width; 0 <= ref2 ? m <= ref2 : m >= ref2; i = 0 <= ref2 ? ++m : --m) {
      context.beginPath();
      context.moveTo(i * wblock - 0.25, 0);
      context.lineTo(i * wblock - 0.25, this.canvas.height);
      context.stroke();
    }
    for (i = n = 0, ref3 = this.map.height; 0 <= ref3 ? n <= ref3 : n >= ref3; i = 0 <= ref3 ? ++n : --n) {
      context.beginPath();
      context.moveTo(0, i * hblock - 0.25);
      context.lineTo(this.canvas.width, i * hblock - 0.25);
      context.stroke();
    }

    // Draw Map content
    this.map.update();
    this.map.draw(context, 0, 0, this.canvas.width, this.canvas.height);
    if (this.map.animated != null && this.map.animated.length > 0) {
      this.needs_update = true;
    }

    // Hover box / cursor
    if (this.mouse_over && !this.is_panning) {
      tw = 1;
      th = 1;
      if (this.editor.tilepicker.selection != null) {
        tw = this.editor.tilepicker.selection.w;
        th = this.editor.tilepicker.selection.h;
      }
      context.strokeStyle = "#000";
      context.lineWidth = 4;
      context.beginPath();
      context.rect(this.mouse_x * wblock, this.mouse_y * hblock, wblock * tw, hblock * th);
      context.stroke();
      context.strokeStyle = "#FFF";
      context.lineWidth = 2;
      context.stroke();
    }

    // Render Minimap
    this.updateMinimap();
  };

  MapView.prototype.updateMinimap = function() {
    if (!this.minimap_canvas || !this.minimap_visible || !this.map) return;
    var mCtx = this.minimap_canvas.getContext("2d");
    var mw = this.minimap_canvas.width;
    var mh = this.minimap_canvas.height;
    
    mCtx.fillStyle = "#111";
    mCtx.fillRect(0, 0, mw, mh);
    
    // Draw map tiles scaled on minimap
    this.map.draw(mCtx, 0, 0, mw, mh);

    // Calculate viewport rectangle
    var c = this.canvas.parentElement;
    if (c && c.clientWidth > 0 && this.canvas.width > 0) {
      var viewLeft = -this.pan_x + (this.canvas.width - c.clientWidth) / 2;
      var viewTop = -this.pan_y + (this.canvas.height - c.clientHeight) / 2;
      var viewW = c.clientWidth;
      var viewH = c.clientHeight;

      var rx = (viewLeft / this.canvas.width) * mw;
      var ry = (viewTop / this.canvas.height) * mh;
      var rw = (viewW / this.canvas.width) * mw;
      var rh = (viewH / this.canvas.height) * mh;

      mCtx.fillStyle = "rgba(0, 200, 255, 0.2)";
      mCtx.fillRect(rx, ry, rw, rh);
      mCtx.strokeStyle = "#00d2ff";
      mCtx.lineWidth = 2;
      mCtx.strokeRect(rx, ry, rw, rh);
    }
  };

  MapView.prototype.mouseDown = function(event) {
    if (event.button === 1 || (event.button === 0 && this.space_pressed)) {
      this.is_panning = true;
      this.pan_start_x = event.clientX - this.pan_x;
      this.pan_start_y = event.clientY - this.pan_y;
      this.canvas.style.cursor = "grabbing";
      return;
    }

    if (!this.editable) {
      return;
    }
    this.mousepressed = true;
    this.mode = event.button === 2 ? "erase" : "draw";
    if (this.map.undo == null) {
      this.map.undo = new Undo();
    }
    if (this.map.undo.empty()) {
      this.map.undo.pushState(this.map.clone());
    }
    return this.mouseMove(event, true);
  };

  MapView.prototype.mouseMove = function(event, force) {
    var b, clickedSprite, i, j, k, l, min, ref, ref1, s, sel, x, y;
    if (force == null) {
      force = false;
    }

    if (this.is_panning) {
      this.pan_x = event.clientX - this.pan_start_x;
      this.pan_y = event.clientY - this.pan_start_y;
      this.updateCanvasPosition();
      this.update();
      return false;
    }

    if (!this.editable) {
      return;
    }

    b = this.canvas.getBoundingClientRect();
    x = event.clientX - b.left;
    y = event.clientY - b.top;
    x = Math.floor(x / this.canvas.width * this.map.width);
    y = Math.floor(y / this.canvas.height * this.map.height);
    this.mouse_over = true;

    if (x !== this.mouse_x || y !== this.mouse_y) {
      this.mouse_x = x;
      this.mouse_y = y;
      this.update();
      this.editor.setCoordinates(x, this.map.height - 1 - y);
    } else if (!force) {
      return false;
    }

    if (this.mousepressed) {
      this.cells_drawn += 1;
      clickedSprite = this.map.get(x, this.map.height - 1 - y);
      if (this.editor.tilepicker.selection != null && this.mode === "draw") {
        sel = this.editor.tilepicker.selection;
        if (event.shiftKey) {
          this.flood_x = x;
          this.flood_y = y;
          this.floodFillMap(clickedSprite, this.sprite, x, y);
        } else {
          for (i = k = 0, ref = sel.w - 1; 0 <= ref ? k <= ref : k >= ref; i = 0 <= ref ? ++k : --k) {
            for (j = l = 0, ref1 = sel.h - 1; 0 <= ref1 ? l <= ref1 : l >= ref1; j = 0 <= ref1 ? ++l : --l) {
              s = this.sprite + ":" + (sel.x + i) + "," + (sel.y + j);
              this.map.set(x + i, this.map.height - 1 - y - j, s);
            }
          }
        }
      } else {
        s = this.mode === "draw" ? this.sprite : null;
        if (event.shiftKey) {
          this.flood_x = x;
          this.flood_y = y;
          this.floodFillMap(clickedSprite, s, x, y);
        } else {
          this.map.set(x, this.map.height - 1 - y, s);
        }
      }
      this.update();
      this.editor.mapChanged();
    }
    return false;
  };

  MapView.prototype.mouseUp = function(event) {
    if (this.is_panning) {
      this.is_panning = false;
      this.canvas.style.cursor = this.space_pressed ? "grab" : "crosshair";
    }
    if (this.mousepressed) {
      this.map.undo.pushState(this.map.clone());
    }
    return this.mousepressed = false;
  };

  MapView.prototype.mouseOut = function(event) {
    if (this.is_panning) {
      this.is_panning = false;
    }
    this.mouse_over = false;
    this.update();
    return this.editor.setCoordinates(-1, -1);
  };

  MapView.prototype.floodFillMap = function(clickedSprite, fillSprite, xs, ys) {
    var clickSprite, s, sel, x, y;
    clickSprite = this.map.get(xs, this.map.height - 1 - ys);
    if (clickSprite !== clickedSprite) {
      return;
    }
    if (typeof clickSprite === "string") {
      clickSprite = clickSprite.split(":")[0];
    }
    if (clickSprite === fillSprite) {
      return;
    }
    if (xs < 0 || xs > this.map.width - 1 || ys < 0 || ys > this.map.height - 1) {
      return;
    }
    sel = this.editor.tilepicker.selection;
    if (sel == null || !fillSprite) {
      this.map.set(xs, this.map.height - 1 - ys, fillSprite);
    } else {
      x = sel.x + (xs - this.flood_x + this.map.width) % sel.w;
      y = sel.y + (ys - this.flood_y + this.map.height) % sel.h;
      s = fillSprite + ":" + x + "," + y;
      this.map.set(xs, this.map.height - 1 - ys, s);
    }
    this.floodFillMap(clickedSprite, fillSprite, xs - 1, ys);
    this.floodFillMap(clickedSprite, fillSprite, xs, ys - 1);
    this.floodFillMap(clickedSprite, fillSprite, xs, ys + 1);
    return this.floodFillMap(clickedSprite, fillSprite, xs + 1, ys);
  };

  MapView.prototype.setMap = function(map) {
    this.map = map;
    this.windowResized();
    return this.update();
  };

  return MapView;
})();

this.MapEditor = class MapEditor extends Manager {
  constructor(app) {
    super(app);
    this.folder = "maps";
    this.item = "map";
    this.list_change_event = "maplist";
    this.get_item = "getMap";
    this.use_thumbnails = false;
    this.extensions = ["json"];
    this.update_list = "updateMapList";
    this.init();
    this.splitbar.auto = 1;
    this.mapeditor_splitbar = new SplitBar("mapeditor-container", "horizontal");
    this.mapeditor_splitbar.initPosition(80);
    this.mapview = new MapView(this);
    this.tilepicker = new TilePicker(this);
    document.getElementById("mapeditor-wrapper").appendChild(this.mapview.canvas);
    this.save_delay = 1000;
    this.save_time = 0;
    setInterval((() => {
      return this.checkSave();
    }), this.save_delay / 2);
    this.app.appui.setAction("create-map-button", () => {
      return this.createMap();
    });
    this.selected_map = null;
    this.app.appui.setAction("undo-map", () => {
      return this.undo();
    });
    this.app.appui.setAction("redo-map", () => {
      return this.redo();
    });
    this.app.appui.setAction("copy-map", () => {
      return this.copy();
    });
    this.app.appui.setAction("cut-map", () => {
      return this.cut();
    });
    this.app.appui.setAction("paste-map", () => {
      return this.paste();
    });
    document.addEventListener("keydown", (event) => {
      if (document.getElementById("mapeditor").offsetParent == null) {
        return;
      }
      //console.info event
      if ((document.activeElement != null) && document.activeElement.tagName.toLowerCase() === "input") {
        return;
      }
      if (event.metaKey || event.ctrlKey) {
        switch (event.key) {
          case "z":
            this.undo();
            break;
          case "Z":
            this.redo();
            break;
          default:
            return;
        }
        event.preventDefault();
        return event.stopPropagation();
      }
    });
    this.background_color_picker = new BackgroundColorPicker(this, (color) => {
      this.mapview.update();
      return document.getElementById("map-background-color").style.background = color;
    });
    this.map_underlay_select = document.getElementById("map-underlay-select");
    this.map_underlay_select.addEventListener("change", () => {
      var name;
      console.info(this.map_underlay_select.value);
      name = this.map_underlay_select.value.replace(/\//g, "-");
      this.map_underlay = name;
      return this.mapview.update();
    });
    document.getElementById("map-background-color").addEventListener("mousedown", (event) => {
      if (this.background_color_picker.shown) {
        return this.background_color_picker.hide();
      } else {
        this.background_color_picker.show();
        return event.stopPropagation();
      }
    });
    // @map_name_validator = new InputValidator document.getElementById("map-name"),
    //   document.getElementById("map-name-button"),
    //   null,
    //   (value)=>
    //     return if @app.project.isLocked("maps/#{@selected_map}.json")
    //     @app.project.lockFile("maps/#{@selected_map}.json")
    //     @saveNameChange(value[0])

    // @map_name_validator.regex = RegexLib.filename
    this.map_size_validator = new InputValidator([document.getElementById("map-width"), document.getElementById("map-height")], document.getElementById("map-size-button"), null, (value) => {
      if (this.app.project.isLocked(`maps/${this.selected_map}.json`)) {
        return;
      }
      this.app.project.lockFile(`maps/${this.selected_map}.json`);
      return this.saveDimensionChange();
    });
    this.map_blocksize_validator = new InputValidator([document.getElementById("map-block-width"), document.getElementById("map-block-height")], document.getElementById("map-blocksize-button"), null, (value) => {
      if (this.app.project.isLocked(`maps/${this.selected_map}.json`)) {
        return;
      }
      this.app.project.lockFile(`maps/${this.selected_map}.json`);
      return this.saveDimensionChange();
    });
    this.map_code_tip = new CodeSnippetField(this.app, "#map-code-tip");

    const btnZoomIn = document.getElementById("map-zoom-in");
    if (btnZoomIn) btnZoomIn.addEventListener("click", () => this.mapview.zoomIn());
    const btnZoomOut = document.getElementById("map-zoom-out");
    if (btnZoomOut) btnZoomOut.addEventListener("click", () => this.mapview.zoomOut());
    const btnZoomFit = document.getElementById("map-zoom-fit");
    if (btnZoomFit) btnZoomFit.addEventListener("click", () => this.mapview.zoomFit());
    const btnZoomReset = document.getElementById("map-zoom-label");
    if (btnZoomReset) btnZoomReset.addEventListener("click", () => this.mapview.zoomReset());
    const btnMinimap = document.getElementById("map-minimap-btn");
    if (btnMinimap) btnMinimap.addEventListener("click", () => this.mapview.toggleMinimap());
  }

  mapChanged() {
    var map;
    if (this.ignore_changes) {
      return;
    }
    this.app.project.lockFile(`maps/${this.selected_map}.json`);
    this.save_time = Date.now();
    this.app.project.addPendingChange(this);
    map = this.app.project.getMap(this.selected_map);
    if (map != null) {
      map.update();
      map.updateCanvases();
      return this.app.runwindow.updateMap(this.selected_map);
    }
  }

  checkSave(immediate = false, callback) {
    if (this.save_time > 0 && (immediate || Date.now() > this.save_time + this.save_delay)) {
      this.saveMap(callback);
      return this.save_time = 0;
    }
  }

  forceSave(callback) {
    return this.checkSave(true, callback);
  }

  projectOpened() {
    super.projectOpened();
    this.app.project.addListener(this);
    return this.setSelectedMap(null);
  }

  update() {
    super.update();
    if (this.mapeditor_splitbar.position > 90) {
      this.mapeditor_splitbar.setPosition(80);
    }
    this.mapeditor_splitbar.update();
    return this.mapview.windowResized();
  }

  projectUpdate(change) {
    var c, name;
    super.projectUpdate(change);
    switch (change) {
      case "spritelist":
        this.rebuildSpriteList();
        break;
      case "locks":
        this.updateCurrentFileLock();
        this.updateActiveUsers();
    }
    if (change instanceof ProjectSprite) {
      name = change.name;
      c = document.querySelector(`#map-sprite-image-${name}`);
      if ((c != null) && (c.updateSprite != null)) {
        return c.updateSprite();
      }
    }
  }

  updateCurrentFileLock() {
    var lock, user;
    if (this.selected_map != null) {
      this.mapview.editable = !this.app.project.isLocked(`maps/${this.selected_map}.json`);
    }
    lock = document.getElementById("map-editor-locked");
    if ((this.selected_map != null) && this.app.project.isLocked(`maps/${this.selected_map}.json`)) {
      user = this.app.project.isLocked(`maps/${this.selected_map}.json`).user;
      lock.style = `display: block; background: ${this.app.appui.createFriendColor(user)}`;
      return lock.innerHTML = `<i class='fa fa-user'></i> Locked by ${user}`;
    } else {
      return lock.style = "display: none";
    }
  }

  saveMap(callback) {
    var cells, data, map, saved;
    if ((this.selected_map == null) || !this.mapview.map) {
      return;
    }
    data = this.mapview.map.save();
    map = this.mapview.map;
    saved = false;
    cells = this.mapview.cells_drawn;
    this.mapview.cells_drawn = 0;
    this.app.client.sendRequest({
      name: "write_project_file",
      project: this.app.project.id,
      file: `maps/${this.selected_map}.json`,
      content: data,
      cells: cells
    }, (msg) => {
      saved = true;
      if (this.save_time === 0) {
        this.app.project.removePendingChange(this);
      }
      map.size = msg.size;
      if (callback != null) {
        return callback();
      }
    });
    return setTimeout((() => {
      if (!saved) {
        this.save_time = Date.now();
        return console.info("retrying map save...");
      }
    }), 10000);
  }

  fileDropped(file, folder) {}

  // required to enable moving maps to the root folder
  createAsset(folder, name = "map", content = "") {
    var map;
    this.checkSave(true);
    if (folder != null) {
      name = folder.getFullDashPath() + `-${name}`;
      folder.setOpen(true);
    }
    map = this.app.project.createMap(name);
    map.resize(this.mapview.map.width, this.mapview.map.height, this.mapview.map.block_width, this.mapview.map.block_height);
    name = map.name;
    return this.app.client.sendRequest({
      name: "write_project_file",
      project: this.app.project.id,
      file: `maps/${name}.json`,
      properties: {},
      content: map.save()
    }, (msg) => {
      this.app.project.updateMapList();
      return this.setSelectedItem(name);
    });
  }

  setSelectedItem(name) {
    this.setSelectedMap(name);
    return super.setSelectedItem(name);
  }

  setSelectedMap(map) {
    var e, m;
    this.selected_map = map;
    if (this.selected_map != null) {
      m = this.app.project.getMap(map);
      this.mapview.setMap(m);
      this.mapview.editable = true;
      document.getElementById("map-width").value = m.width;
      document.getElementById("map-height").value = m.height;
      document.getElementById("map-block-width").value = m.block_width;
      document.getElementById("map-block-height").value = m.block_height;
      this.map_size_validator.update();
      this.map_blocksize_validator.update();
      e = document.getElementById("mapeditor-wrapper");
      if (e.firstChild != null) {
        e.firstChild.style.display = "inline-block";
      }
    } else {
      e = document.getElementById("mapeditor-wrapper");
      if (e.firstChild != null) {
        e.firstChild.style.display = "none";
      }
    }
    this.updateCurrentFileLock();
    this.tilepicker.update();
    this.setCoordinates(-1, -1);
    return this.updateCodeTip();
  }

  setMap(data) {
    var map;
    map = MicroMap.loadMap(data, this.app.project.sprite_table);
    this.mapview.setMap(map);
    this.mapview.editable = true;
    document.getElementById("map-width").value = map.width;
    document.getElementById("map-height").value = map.height;
    this.map_size_validator.update();
    this.map_blocksize_validator.update();
    return this.tilepicker.update();
  }

  rebuildList() {
    var i, len, m, option, ref, select;
    super.rebuildList();
    if ((this.selected_map != null) && (this.app.project.getMap(this.selected_map) == null)) {
      this.setSelectedItem(null);
    }
    select = document.getElementById("map-underlay-select");
    select.innerHTML = "";
    option = document.createElement("option");
    option.name = " ";
    option.value = " ";
    option.innerText = " ";
    select.appendChild(option);
    ref = this.app.project.map_list;
    for (i = 0, len = ref.length; i < len; i++) {
      m = ref[i];
      option = document.createElement("option");
      option.name = m.name;
      option.value = m.name;
      option.innerText = m.name.replace(/-/g, "/");
      select.appendChild(option);
    }
    if (this.map_underlay != null) {
      select.value = this.map_underlay;
    }
  }

  setCoordinates(x, y) {
    var e;
    e = document.getElementById("map-coordinates");
    if (x < 0 || y < 0) {
      return e.innerText = "";
    } else {
      return e.innerText = `${x} , ${y}`;
    }
  }

  openMap(s) {
    if (this.map_name_change != null) {
      return this.saveNameChange(() => {
        return this.openMap(s);
      });
    }
    this.checkSave(true);
    return this.setSelectedMap(s);
  }

  saveDimensionChange() {
    var bh, bw, err, h, w;
    this.map_dimension_change = null;
    w = document.getElementById("map-width").value;
    h = document.getElementById("map-height").value;
    bw = document.getElementById("map-block-width").value;
    bh = document.getElementById("map-block-height").value;
    try {
      w = Number.parseFloat(w);
      h = Number.parseFloat(h);
      bw = Number.parseFloat(bw);
      bh = Number.parseFloat(bh);
    } catch (error) {
      err = error;
    }
    if (Number.isInteger(w) && Number.isInteger(h) && w > 0 && h > 0 && w < 129 && h < 129 && (this.selected_map != null) && (w !== this.mapview.map.width || h !== this.mapview.map.height || bw !== this.mapview.map.block_width || bh !== this.mapview.map.block_height) && Number.isInteger(bw) && Number.isInteger(bh) && bw > 0 && bh > 0 && bw < 65 && bh < 65) {
      if (this.mapview.map.undo == null) {
        this.mapview.map.undo = new Undo();
      }
      if (this.mapview.map.undo.empty()) {
        this.mapview.map.undo.pushState(this.mapview.map.clone());
      }
      this.mapview.map.resize(w, h, bw, bh);
      this.mapview.map.undo.pushState(this.mapview.map.clone());
      this.mapview.windowResized();
      this.mapview.update();
      this.mapChanged();
      this.checkSave(true);
      document.getElementById("map-width").value = this.mapview.map.width;
      document.getElementById("map-height").value = this.mapview.map.height;
      document.getElementById("map-block-width").value = this.mapview.map.block_width;
      document.getElementById("map-block-height").value = this.mapview.map.block_height;
      this.map_size_validator.update();
      return this.map_blocksize_validator.update();
    } else {
      document.getElementById("map-width").value = this.mapview.map.width;
      document.getElementById("map-height").value = this.mapview.map.height;
      document.getElementById("map-block-width").value = this.mapview.map.block_width;
      document.getElementById("map-block-height").value = this.mapview.map.block_height;
      this.map_size_validator.update();
      return this.map_blocksize_validator.update();
    }
  }

  rebuildSpriteList() {
    var ProjectSpriteClone, folder, i, len, manager, ref, s;
    if (this.sprite_folder_view == null) {
      manager = {
        folder: "sprites",
        item: "sprite",
        openItem: (item) => {
          this.mapview.sprite = item;
          this.sprite_folder_view.setSelectedItem(item);
          return this.tilepicker.update();
        }
      };
      this.sprite_folder_view = new FolderView(manager, document.querySelector("#map-sprite-list"));
      this.sprite_folder_view.editable = false;
    }
    folder = new ProjectFolder(null, "sprites");
    ProjectSpriteClone = class ProjectSpriteClone {
      constructor(project_sprite) {
        this.project_sprite = project_sprite;
        this.name = this.project_sprite.name;
        this.shortname = this.project_sprite.shortname;
      }

      getThumbnailElement() {
        return this.project_sprite.getThumbnailElement();
      }

      canBeRenamed() {
        return false;
      }

    };
    ref = this.app.project.sprite_list;
    for (i = 0, len = ref.length; i < len; i++) {
      s = ref[i];
      folder.push(new ProjectSpriteClone(s), s.name);
    }
    this.sprite_folder_view.rebuildList(folder);
  }

  currentMapUpdated() {
    this.mapview.update();
    this.mapview.windowResized();
    return this.updateSizeFields();
  }

  updateSizeFields() {
    if (this.mapview.map != null) {
      document.getElementById("map-width").value = this.mapview.map.width;
      document.getElementById("map-height").value = this.mapview.map.height;
      document.getElementById("map-block-width").value = this.mapview.map.block_width;
      document.getElementById("map-block-height").value = this.mapview.map.block_height;
      this.map_size_validator.update();
      return this.map_blocksize_validator.update();
    }
  }

  undo() {
    var s;
    if (this.app.project.isLocked(`maps/${this.selected_map}.json`)) {
      return;
    }
    this.app.project.lockFile(`maps/${this.selected_map}.json`);
    if (this.mapview.map && (this.mapview.map.undo != null)) {
      s = this.mapview.map.undo.undo(() => {
        return this.mapview.map.clone();
      });
      if (s != null) {
        this.mapview.map.copyFrom(s);
        this.currentMapUpdated();
        return this.mapChanged();
      }
    }
  }

  redo() {
    var s;
    if (this.app.project.isLocked(`maps/${this.selected_map}.json`)) {
      return;
    }
    this.app.project.lockFile(`maps/${this.selected_map}.json`);
    if (this.mapview.map && (this.mapview.map.undo != null)) {
      s = this.mapview.map.undo.redo();
      if (s != null) {
        this.mapview.map.copyFrom(s);
        this.currentMapUpdated();
        return this.mapChanged();
      }
    }
  }

  copy() {
    return this.clipboard = this.mapview.map.clone();
  }

  cut() {
    if (this.app.project.isLocked(`maps/${this.selected_map}.json`)) {
      return;
    }
    this.app.project.lockFile(`maps/${this.selected_map}.json`);
    this.clipboard = this.mapview.map.clone();
    if (this.mapview.map.undo == null) {
      this.mapview.map.undo = new Undo();
    }
    if (this.mapview.map.undo.empty()) {
      this.mapview.map.undo.pushState(this.mapview.map.clone());
    }
    this.mapview.map.clear();
    this.mapview.map.undo.pushState(this.mapview.map.clone());
    this.currentMapUpdated();
    return this.mapChanged();
  }

  paste() {
    if (this.app.project.isLocked(`maps/${this.selected_map}.json`)) {
      return;
    }
    this.app.project.lockFile(`maps/${this.selected_map}.json`);
    if (this.clipboard != null) {
      if (this.mapview.map.undo == null) {
        this.mapview.map.undo = new Undo();
      }
      if (this.mapview.map.undo.empty()) {
        this.mapview.map.undo.pushState(this.mapview.map.clone());
      }
      this.mapview.map.copyFrom(this.clipboard);
      this.mapview.map.undo.pushState(this.mapview.map.clone());
      this.currentMapUpdated();
      return this.mapChanged();
    }
  }

  updateCodeTip() {
    var code, h, map, w;
    if ((this.selected_map != null) && (this.app.project.getMap(this.selected_map) != null)) {
      map = this.app.project.getMap(this.selected_map);
      if (map.width > map.height) {
        h = 200;
        w = Math.round(map.width / map.height * 200);
      } else {
        w = 200;
        h = Math.round(map.height / map.width * 200);
      }
      code = `screen.drawMap( "${this.selected_map.replace(/-/g, "/")}", 0, 0, ${w}, ${h} )`;
    } else {
      code = "";
    }
    return this.map_code_tip.set(code);
  }

};

this.BackgroundColorPicker = class BackgroundColorPicker {
  constructor(editor, callback1, editorid = "map") {
    this.editor = editor;
    this.callback = callback1;
    this.editorid = editorid;
    this.tool = document.createElement("div");
    this.tool.classList.add("value-tool");
    this.color = [0, 0, 0];
    this.picker = new ColorPicker(this);
    this.tool.appendChild(this.picker.canvas);
    this.picker.colorPicked([0, 0, 0]);
    document.getElementById(`${this.editorid}s-section`).appendChild(this.tool);
    this.started = true;
    this.tool.addEventListener("mousedown", function(event) {
      return event.stopPropagation();
    });
    document.addEventListener("mousedown", (event) => {
      return this.hide();
    });
    this.hide();
  }

  setColor(color1) {
    this.color = color1;
    return this.callback(this.color);
  }

  hide() {
    this.tool.style.display = "none";
    return this.shown = false;
  }

  show() {
    var e;
    e = document.getElementById(this.editorid + "-background-color");
    this.y = e.getBoundingClientRect().y;
    this.x = e.getBoundingClientRect().x + e.getBoundingClientRect().width / 2;
    this.y = Math.max(0, this.y - 100) + document.querySelector("#editor-view .ace_content").getBoundingClientRect().y;
    this.x = Math.max(0, this.x + 25) + document.querySelector("#editor-view .ace_content").getBoundingClientRect().x;
    this.tool.style = `z-index: 20;top:${this.y - 200}px;left:${this.x - 75}px;`;
    this.tool.style.display = "block";
    return this.shown = true;
  }

};

this.TilePicker = (function() {
  function TilePicker(mapeditor) {
    this.mapeditor = mapeditor;
    this.element = document.getElementById("map-tilepicker");
    window.addEventListener("resize", (function(_this) {
      return function(event) {
        return _this.update();
      };
    })(this));
    this.zoom = 1;
    this.offset_x = 0;
    this.offset_y = 0;
    document.getElementById("mapbar").addEventListener("keydown", (function(_this) {
      return function(e) {
        if (e.keyCode === 32) {
          _this.space_pressed = true;
          if (_this.canvas != null) {
            _this.canvas.style.cursor = "grab";
          }
          return e.preventDefault();
        }
      };
    })(this));
    document.addEventListener("keyup", (function(_this) {
      return function(e) {
        if (e.keyCode === 32) {
          _this.space_pressed = false;
          if (_this.canvas != null) {
            return _this.canvas.style.cursor = "crosshair";
          }
        }
      };
    })(this));
  }

  TilePicker.prototype.update = function() {
    var bh, bw, context, h, i, j, k, l, m, r, ref, ref1, ref2, ref3, ref4, ref5, ref6, ref7, sprite, w, ww;
    this.map = this.mapeditor.mapview.map;
    sprite = this.mapeditor.mapview.sprite;
    if ((this.map != null) && (sprite != null) && (this.mapeditor.app.project != null)) {
      this.sprite = this.mapeditor.app.project.getSprite(sprite);
      if ((this.sprite != null) && (this.sprite.width > this.map.block_width || this.sprite.height > this.map.block_height)) {
        if (this.sprite.tile_selection != null) {
          this.selection = this.sprite.tile_selection;
        } else {
          this.selection = {
            x: 0,
            y: 0,
            w: 1,
            h: 1
          };
        }
        this.zoom = this.sprite.tile_zoom != null ? this.sprite.tile_zoom : 1;
        this.offset_x = this.sprite.tile_offset_x != null ? this.sprite.tile_offset_x : 0;
        this.offset_y = this.sprite.tile_offset_y != null ? this.sprite.tile_offset_y : 0;
        ww = Math.max(1, this.element.getBoundingClientRect().width - 20);
        r = ww / Math.max(this.sprite.width, this.sprite.height);
        this.ratio = r;
        w = r * this.sprite.width;
        h = r * this.sprite.height;
        if (this.canvas == null) {
          this.canvas = document.createElement("canvas");
          this.element.appendChild(this.canvas);
          this.canvas.addEventListener("mousedown", (function(_this) {
            return function(event) {
              return _this.mouseDown(event);
            };
          })(this));
          this.canvas.addEventListener("mousemove", (function(_this) {
            return function(event) {
              return _this.mouseMove(event);
            };
          })(this));
          this.canvas.addEventListener("mouseenter", (function(_this) {
            return function(event) {
              return _this.mouseEnter(event);
            };
          })(this));
          this.canvas.addEventListener("mouseout", (function(_this) {
            return function(event) {
              return _this.mouseOut(event);
            };
          })(this));
          document.addEventListener("mouseup", (function(_this) {
            return function(event) {
              return _this.mouseUp(event);
            };
          })(this));
          this.canvas.addEventListener("mousewheel", ((function(_this) {
            return function(e) {
              return _this.mouseWheel(e);
            };
          })(this)), false);
          this.canvas.addEventListener("DOMMouseScroll", ((function(_this) {
            return function(e) {
              return _this.mouseWheel(e);
            };
          })(this)), false);
        }
        this.canvas.width = w;
        this.canvas.height = h;
        document.getElementById("map-sprite-list").style.top = (h + 20) + "px";
        context = this.canvas.getContext("2d");
        context.save();
        if (this.zoom) {
          context.translate(-this.offset_x, -this.offset_y);
          context.scale(this.zoom, this.zoom);
        }
        context.imageSmoothingEnabled = false;
        context.drawImage(this.sprite.frames[0].getCanvas(), 0, 0, w, h);
        bw = this.map.block_width * r;
        bh = this.map.block_height * r;
        context.lineWidth = .5;
        context.strokeStyle = "rgba(0,0,0,.5)";
        for (i = j = 0, ref = w, ref1 = bw * 2; ref1 > 0 ? j <= ref : j >= ref; i = j += ref1) {
          context.strokeRect(i + .25, -2, bw, h + 4);
        }
        for (i = k = 0, ref2 = h, ref3 = bh * 2; ref3 > 0 ? k <= ref2 : k >= ref2; i = k += ref3) {
          context.strokeRect(-2, i + .25, w + 4, bh);
        }
        context.strokeStyle = "rgba(255,255,255,.5)";
        for (i = l = 0, ref4 = w, ref5 = bw * 2; ref5 > 0 ? l <= ref4 : l >= ref4; i = l += ref5) {
          context.strokeRect(i - .25, -2, bw, h + 4);
        }
        for (i = m = 0, ref6 = h, ref7 = bh * 2; ref7 > 0 ? m <= ref6 : m >= ref6; i = m += ref7) {
          context.strokeRect(-2, i - .25, w + 4, bh);
        }
        if (this.hover != null) {
          context.save();
          context.lineWidth = 2;
          context.strokeStyle = "#CCC";
          context.shadowOpacity = 1;
          context.shadowBlur = 4;
          context.shadowColor = "#000";
          context.strokeRect(this.hover.x * bw - 1, this.hover.y * bh - 1, bw + 2, bh + 2);
          context.restore();
        }
        if (this.selection != null) {
          context.save();
          context.lineWidth = 3;
          context.strokeStyle = "#FFF";
          context.shadowOpacity = 1;
          context.shadowBlur = 4;
          context.shadowColor = "#000";
          context.strokeRect(this.selection.x * bw, this.selection.y * bh, this.selection.w * bw, this.selection.h * bh);
          context.restore();
        }
        context.restore();
        this.canvas.style.display = "inline-block";
        document.querySelector(".mapbar").scrollTo(0, 0);
        return;
      }
    }
    if (this.canvas != null) {
      this.selection = null;
      this.canvas.style.display = "none";
    }
    return document.getElementById("map-sprite-list").style.top = "0px";
  };

  TilePicker.prototype.mouseDown = function(event) {
    var b, bh, bw, x, y;
    this.mousedown = true;
    b = this.canvas.getBoundingClientRect();
    x = event.clientX - b.left;
    y = event.clientY - b.top;
    if (this.space_pressed) {
      this.drag_start_x = x;
      this.drag_start_y = y;
      this.offset_start_x = this.offset_x;
      this.offset_start_y = this.offset_y;
      return this.drag_view = true;
    } else {
      this.drag_view = false;
      bw = this.ratio * this.map.block_width * this.zoom;
      bh = this.ratio * this.map.block_height * this.zoom;
      x = Math.floor((x + this.offset_x) / bw);
      y = Math.floor((y + this.offset_y) / bh);
      this.selection = {
        x: x,
        y: y,
        w: 1,
        h: 1
      };
      this.sprite.tile_selection = this.selection;
      this.selection_start_x = x;
      this.selection_start_y = y;
      this.update();
      return this.mouseMove(event);
    }
  };

  TilePicker.prototype.mouseUp = function(event) {
    return this.mousedown = false;
  };

  TilePicker.prototype.mouseMove = function(event) {
    var b, bh, bw, sh, sw, sx, sy, th, tw, x, y;
    b = this.canvas.getBoundingClientRect();
    x = event.clientX - b.left;
    y = event.clientY - b.top;
    if (this.drag_view && this.mousedown) {
      this.offset_x = this.offset_start_x - (x - this.drag_start_x);
      this.offset_y = this.offset_start_y - (y - this.drag_start_y);
      this.fixOffset();
      return this.update();
    } else {
      bw = this.ratio * this.map.block_width * this.zoom;
      bh = this.ratio * this.map.block_height * this.zoom;
      x = Math.floor((x + this.offset_x) / bw);
      y = Math.floor((y + this.offset_y) / bh);
      if (this.mousedown) {
        sx = x < this.selection_start_x ? x : this.selection_start_x;
        sy = y < this.selection_start_y ? y : this.selection_start_y;
        sw = Math.max(x + 1 - this.selection_start_x, this.selection_start_x - x + 1);
        sh = Math.max(y + 1 - this.selection_start_y, this.selection_start_y - y + 1);
        tw = Math.floor(this.sprite.width / this.map.block_width);
        th = Math.floor(this.sprite.height / this.map.block_height);
        sx = Math.max(0, Math.min(tw - sw, sx));
        sy = Math.max(0, Math.min(th - sh, sy));
        sw = Math.max(1, Math.min(tw - sx, sw));
        sh = Math.max(1, Math.min(th - sy, sh));
        if (sx !== this.selection.x || sy !== this.selection.y || sw !== this.selection.w || sh !== this.selection.h) {
          this.selection.x = sx;
          this.selection.y = sy;
          this.selection.w = sw;
          this.selection.h = sh;
          return this.update();
        }
      } else if ((this.hover == null) || x !== this.hover.x || y !== this.hover.y) {
        if (this.hover == null) {
          this.hover = {};
        }
        this.hover.x = x;
        this.hover.y = y;
        return this.update();
      }
    }
  };

  TilePicker.prototype.mouseEnter = function(event) {
    return document.getElementById("mapbar").focus();
  };

  TilePicker.prototype.mouseOut = function(event) {
    if (this.hover != null) {
      this.hover = null;
      return this.update();
    }
  };

  TilePicker.prototype.mouseWheel = function(e) {
    var b, fx, fy, x, y;
    e.preventDefault();
    if (this.next_wheel_action == null) {
      this.next_wheel_action = Date.now();
    }
    if (Date.now() < this.next_wheel_action) {
      return;
    }
    this.next_wheel_action = Date.now() + 50;
    b = this.canvas.getBoundingClientRect();
    x = event.clientX - b.left;
    y = event.clientY - b.top;
    fx = (this.offset_x + x) / (this.canvas.width * this.zoom);
    fy = (this.offset_y + y) / (this.canvas.height * this.zoom);
    if (e.wheelDelta < 0 || e.detail > 0) {
      this.zoom = Math.max(1, this.zoom / 1.1);
    } else {
      this.zoom = Math.min(4, this.zoom * 1.1);
    }
    this.offset_x = fx * this.canvas.width * this.zoom - x;
    this.offset_y = fy * this.canvas.height * this.zoom - y;
    this.fixOffset();
    return this.update();
  };

  TilePicker.prototype.fixOffset = function() {
    var h, w;
    if (this.canvas == null) {
      return;
    }
    w = this.canvas.width;
    h = this.canvas.height;
    this.offset_x = Math.max(0, Math.min(w * (this.zoom - 1), this.offset_x));
    this.offset_y = Math.max(0, Math.min(h * (this.zoom - 1), this.offset_y));
    if (this.sprite != null) {
      this.sprite.tile_zoom = this.zoom;
      this.sprite.tile_offset_x = this.offset_x;
      return this.sprite.tile_offset_y = this.offset_y;
    }
  };

  return TilePicker;

})();

this.MicroMap = (function() {
  function MicroMap(width, height, block_width, block_height, sprites1) {
    var req;
    this.width = width;
    this.height = height;
    this.block_width = block_width;
    this.block_height = block_height;
    this.sprites = sprites1;
    this.map = [];
    if ((this.width != null) && typeof this.width === "string") {
      this.ready = false;
      req = new XMLHttpRequest();
      req.onreadystatechange = (function(_this) {
        return function(event) {
          if (req.readyState === XMLHttpRequest.DONE) {
            _this.ready = true;
            if (req.status === 200) {
              _this.load(req.responseText, _this.sprites);
              _this.update();
            }
            if (_this.loaded != null) {
              return _this.loaded();
            }
          }
        };
      })(this);
      req.open("GET", this.width);
      req.send();
      this.width = 10;
      this.height = 10;
      this.block_width = 10;
      this.block_height = 10;
    } else {
      this.ready = true;
    }
    this.clear();
    this.update();
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
      return context.drawImage(this.buffer, x, y, w, h);
    } else {
      return context.drawImage(this.getCanvas(), x, y, w, h);
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

  MicroMap.prototype.resize = function(w, h, block_width, block_height) {
    var i, j, k, l, map, ref1, ref2;
    this.block_width = block_width != null ? block_width : this.block_width;
    this.block_height = block_height != null ? block_height : this.block_height;
    map = [];
    for (j = k = 0, ref1 = h - 1; k <= ref1; j = k += 1) {
      for (i = l = 0, ref2 = w - 1; l <= ref2; i = l += 1) {
        if (j < this.height && i < this.width) {
          map[i + j * w] = this.map[i + j * this.width];
        } else {
          map[i + j * w] = null;
        }
      }
    }
    this.map = map;
    this.width = w;
    return this.height = h;
  };

  MicroMap.prototype.save = function() {
    var data, i, index, j, k, l, list, m, map, n, ref1, ref2, ref3, ref4, s, table;
    var w = (this.width != null && Number.isInteger(this.width) && this.width > 0) ? this.width : 16;
    var h = (this.height != null && Number.isInteger(this.height) && this.height > 0) ? this.height : 10;
    var bw = (this.block_width != null && Number.isInteger(this.block_width) && this.block_width > 0) ? this.block_width : 16;
    var bh = (this.block_height != null && Number.isInteger(this.block_height) && this.block_height > 0) ? this.block_height : 16;
    index = 1;
    list = [0];
    table = {};
    for (j = k = 0, ref1 = h - 1; k <= ref1; j = k += 1) {
      for (i = l = 0, ref2 = w - 1; l <= ref2; i = l += 1) {
        s = this.map ? this.map[i + j * w] : null;
        if ((s != null) && s.length > 0 && (table[s] == null)) {
          list.push(s);
          table[s] = index++;
        }
      }
    }
    map = [];
    for (j = m = 0, ref3 = h - 1; m <= ref3; j = m += 1) {
      for (i = n = 0, ref4 = w - 1; n <= ref4; i = n += 1) {
        s = this.map ? this.map[i + j * w] : null;
        map[i + j * w] = (s != null) && s.length > 0 ? table[s] : 0;
      }
    }
    data = {
      width: w,
      height: h,
      block_width: bw,
      block_height: bh,
      sprites: list,
      data: map
    };
    return JSON.stringify(data);
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
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
        if (typeof data === "string") {
          data = JSON.parse(data);
        }
      } catch (e) {
        console.warn("MicroMap load parse error:", e);
        return;
      }
    }
    if (!data || typeof data !== "object") return;
    this.width = Number.isInteger(data.width) ? data.width : (this.width || 16);
    this.height = Number.isInteger(data.height) ? data.height : (this.height || 10);
    this.block_width = Number.isInteger(data.block_width) ? data.block_width : (this.block_width || 16);
    this.block_height = Number.isInteger(data.block_height) ? data.block_height : (this.block_height || 16);
    this.map = [];
    var spritesList = Array.isArray(data.sprites) ? data.sprites : [0];
    var dataList = Array.isArray(data.data) ? data.data : [];
    for (j = k = 0, ref1 = this.height - 1; k <= ref1; j = k += 1) {
      for (i = l = 0, ref2 = this.width - 1; l <= ref2; i = l += 1) {
        s = dataList[i + j * this.width];
        if (s > 0 && spritesList[s] != null) {
          this.map[i + j * this.width] = spritesList[s];
        } else {
          this.map[i + j * this.width] = null;
        }
      }
    }
    this.needs_update = true;
  };

  MicroMap.loadMap = function(data, sprites) {
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
        if (typeof data === "string") {
          data = JSON.parse(data);
        }
      } catch (e) {
        data = {};
      }
    }
    var w = (data && Number.isInteger(data.width)) ? data.width : 16;
    var h = (data && Number.isInteger(data.height)) ? data.height : 10;
    var bw = (data && Number.isInteger(data.block_width)) ? data.block_width : 16;
    var bh = (data && Number.isInteger(data.block_height)) ? data.block_height : 16;
    var map = new MicroMap(w, h, bw, bh, sprites);
    map.load(data, sprites);
    return map;
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

var indexOf = [].indexOf;

this.AssetsManager = class AssetsManager extends Manager {
  constructor(app) {
    super(app);
    this.folder = "assets";
    this.item = "asset";
    this.list_change_event = "assetlist";
    this.get_item = "getAsset";
    this.use_thumbnails = true;
    this.extensions = ["glb", "obj", "json", "ttf", "png", "jpg", "txt", "csv", "md", "wasm"];
    this.update_list = "updateAssetList";
    this.model_viewer = new ModelViewer(this);
    this.font_viewer = new FontViewer(this);
    this.image_viewer = new ImageViewer(this);
    this.text_viewer = new TextViewer(this);
    this.init();
    document.querySelector("#capture-asset").addEventListener("click", () => {
      if (this.asset != null) {
        switch (this.asset.ext) {
          case "glb":
          case "obj":
            return this.model_viewer.updateThumbnail();
        }
      }
    });
    this.code_snippet = new CodeSnippet(this.app);
  }

  init() {
    super.init();
    return this.splitbar.initPosition(30);
  }

  update() {
    return super.update();
  }

  checkThumbnail(asset, callback) {
    var img, url;
    url = asset.getThumbnailURL();
    img = new Image;
    img.src = url;
    return img.onload = () => {
      var canvas, ctx, data;
      if (img.width > 0 && img.height > 0) {
        canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        ctx = canvas.getContext("2d");
        ctx.drawImage(img, -31, -31);
        data = ctx.getImageData(0, 0, 1, 1);
        if (data.data[3] > 128) {
          return;
        }
      }
      return callback();
    };
  }

  selectedItemRenamed() {
    if ((this.selected_item != null) && (this.viewer != null)) {
      return this.viewer.updateSnippet();
    }
  }

  selectedItemDeleted() {
    var e, j, len, parent, ref;
    parent = document.getElementById("asset-viewer");
    ref = parent.childNodes;
    for (j = 0, len = ref.length; j < len; j++) {
      e = ref[j];
      e.style.display = "none";
    }
    this.viewer = null;
    this.asset = null;
    this.code_snippet.clear();
  }

  openItem(name) {
    var e, j, len, parent, ref;
    super.openItem(name);
    this.asset = this.app.project.getAsset(name);
    console.info(this.asset);
    parent = document.getElementById("asset-viewer");
    ref = parent.childNodes;
    for (j = 0, len = ref.length; j < len; j++) {
      e = ref[j];
      e.style.display = "none";
    }
    if (this.asset != null) {
      switch (this.asset.ext) {
        case "ttf":
          this.font_viewer.view(this.asset);
          return this.viewer = this.font_viewer;
        case "glb":
        case "obj":
          this.model_viewer.view(this.asset);
          return this.viewer = this.model_viewer;
        case "json":
        case "txt":
        case "csv":
        case "md":
          this.text_viewer.view(this.asset);
          return this.viewer = this.text_viewer;
        case "png":
        case "jpg":
          this.image_viewer.view(this.asset);
          return this.viewer = this.image_viewer;
        case "wasm":
          return this.checkWASMThumbnail(this.asset);
      }
    }
  }

  createAsset(folder) {
    var input;
    input = document.createElement("input");
    input.type = "file";
    //input.accept = ".glb"
    input.addEventListener("change", (event) => {
      var f, files, j, len;
      files = event.target.files;
      if (files.length >= 1) {
        for (j = 0, len = files.length; j < len; j++) {
          f = files[j];
          this.fileDropped(f, folder);
        }
      }
    });
    return input.click();
  }

  fileDropped(file, folder) {
    var ext, name, reader, ref, split;
    console.info(`processing ${file.name}`);
    console.info("folder: " + folder);
    reader = new FileReader();
    split = file.name.split(".");
    name = split[0];
    ext = split[split.length - 1];
    if (ref = !ext, indexOf.call(this.extensions, ref) >= 0) {
      return;
    }
    reader.addEventListener("load", () => {
      var asset, canvas, data;
      console.info("file read, size = " + reader.result.length);
      if (reader.result.length > 30000000) { // client-side file size limit 30 Mb
        return;
      }
      name = this.findNewFilename(name, "getAsset", folder);
      if (folder != null) {
        name = folder.getFullDashPath() + "-" + name;
      }
      if (folder != null) {
        folder.setOpen(true);
      }
      canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      asset = this.app.project.createAsset(name, canvas.toDataURL(), reader.result.length, ext);
      asset.uploading = true;
      if (ext === "json" || ext === "csv" || ext === "txt" || ext === "md") {
        asset.local_text = reader.result;
      } else {
        asset.local_url = reader.result;
      }
      this.setSelectedItem(name);
      this.openItem(name);
      if (ext === "json" || ext === "csv" || ext === "txt" || ext === "md") {
        data = reader.result;
      } else {
        data = reader.result.split(",")[1];
      }
      this.app.project.addPendingChange(this);
      return this.app.client.sendRequest({
        name: "write_project_file",
        project: this.app.project.id,
        file: `assets/${name}.${ext}`,
        properties: {},
        content: data,
        thumbnail: canvas.toDataURL().split(",")[1]
      }, (msg) => {
        console.info(msg);
        this.app.project.removePendingChange(this);
        asset.uploading = false;
        delete asset.local_url;
        this.app.project.updateAssetList();
        return this.checkNameFieldActivation();
      });
    });
    if (ext === "json" || ext === "csv" || ext === "txt" || ext === "md") {
      return reader.readAsText(file);
    } else {
      return reader.readAsDataURL(file);
    }
  }

  updateAssetIcon(asset, canvas) {
    var color, context, h, t, tw, w;
    context = canvas.getContext("2d");
    color = (function() {
      switch (asset.ext) {
        case "ttf":
          return "hsl(200,50%,60%)";
        case "json":
          return "hsl(0,50%,60%)";
        case "csv":
          return "hsl(60,50%,60%)";
        case "txt":
          return "hsl(160,50%,60%)";
        case "md":
          return "hsl(270,50%,60%)";
        case "glb":
          return "hsl(300,50%,60%)";
        case "obj":
          return "hsl(240,50%,70%)";
        case "wasm":
          return "hsl(60,50%,60%)";
        default:
          return "hsl(0,0%,60%)";
      }
    })();
    w = canvas.width;
    h = canvas.height;
    context.fillStyle = "#222";
    context.fillRect(w - 30, h - 16, 30, 16);
    context.fillStyle = color;
    context.fillRect(0, h - 2, w, 2);
    context.font = "7pt sans-serif";
    t = asset.ext.toUpperCase();
    tw = context.measureText(t).width;
    context.fillText(`${asset.ext.toUpperCase()}`, w - tw - 2, h - 5);
    asset.thumbnail_url = canvas.toDataURL();
    this.app.client.sendRequest({
      name: "write_project_file",
      project: this.app.project.id,
      file: `assets/${asset.name}.${asset.ext}`,
      thumbnail: canvas.toDataURL().split(",")[1]
    }, (msg) => {
      return console.info(msg);
    });
    if (asset.element != null) {
      return asset.element.querySelector("img").src = canvas.toDataURL();
    }
  }

  checkWASMThumbnail(asset) {
    return this.checkThumbnail(asset, () => {
      return this.createWASMThumbnail(asset.getURL(), (canvas) => {
        if (asset.element != null) {
          asset.element.querySelector("img").src = canvas.toDataURL();
        }
        return this.updateAssetIcon(asset, canvas);
      });
    });
  }

  createWASMThumbnail(url, callback) {
    var canvas, context, t, tw;
    canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 96;
    context = canvas.getContext("2d");
    context.save();
    context.fillStyle = "#222";
    context.fillRect(0, 0, canvas.width, canvas.height);
    t = "</>";
    context.font = "36pt monospace";
    context.fillStyle = "hsl(20,50%,30%)";
    tw = context.measureText(t).width;
    context.fillText(t, 64 - tw / 2, 60);
    return callback(canvas);
  }

};

this.CodeSnippet = class CodeSnippet {
  constructor(app1) {
    var copyable;
    this.app = app1;
    copyable = true;
    this.container = document.querySelector("#asset-load-code");
    this.input = document.querySelector("#asset-load-code input");
    this.select = document.querySelector("#asset-load-code select");
    this.select.addEventListener("change", () => {
      return this.setIndex(this.select.selectedIndex);
    });
    document.querySelector("#asset-load-code i").addEventListener("click", () => {
      var code, copy, input;
      if (!copyable) {
        return;
      }
      input = document.querySelector("#asset-load-code input");
      copy = document.querySelector("#asset-load-code i");
      code = input.value;
      navigator.clipboard.writeText(code);
      input.value = this.app.translator.get("Copied!");
      copyable = false;
      copy.classList.remove("fa-copy");
      copy.classList.add("fa-check");
      return setTimeout((() => {
        copy.classList.remove("fa-check");
        copy.classList.add("fa-copy");
        input.value = code;
        return copyable = true;
      }), 1000);
    });
  }

  clear() {
    this.select.innerHTML = "";
    this.input.value = "";
    return this.container.style.display = "none";
  }

  set(list) {
    var i, j, len, name, option, ref, snippet, value;
    this.list = list;
    this.clear();
    ref = this.list;
    for (i = j = 0, len = ref.length; j < len; i = ++j) {
      snippet = ref[i];
      name = this.app.translator.get(snippet.name);
      value = snippet.value;
      option = document.createElement("option");
      option.value = i;
      option.innerText = name;
      this.select.appendChild(option);
      if (i === 0) {
        this.input.value = snippet.value;
      }
    }
    return this.container.style.display = "block";
  }

  setIndex(index) {
    if ((this.list != null) && index < this.list.length) {
      return this.input.value = this.list[index].value;
    }
  }

};

this.CodeSnippetField = class CodeSnippetField {
  constructor(app1, query) {
    var copyable;
    this.app = app1;
    this.element = document.querySelector(query);
    this.input = this.element.querySelector("input");
    this.i = this.element.querySelector("i");
    copyable = true;
    this.i.addEventListener("click", () => {
      var code;
      if (!copyable) {
        return;
      }
      code = this.input.value;
      navigator.clipboard.writeText(code);
      this.input.value = this.app.translator.get("Copied!");
      copyable = false;
      this.i.classList.remove("fa-copy");
      this.i.classList.add("fa-check");
      return setTimeout((() => {
        this.i.classList.remove("fa-check");
        this.i.classList.add("fa-copy");
        this.input.value = this.code;
        return copyable = true;
      }), 1000);
    });
  }

  set(code1) {
    this.code = code1;
    return this.input.value = this.code;
  }

};

this.ModelViewer = class ModelViewer {
  constructor(manager) {
    this.manager = manager;
    this.element = document.getElementById("model-asset-viewer");
  }

  updateSnippet() {
    return this.manager.code_snippet.set([
      {
        name: "Load Model",
        value: `loader = asset_manager.loadModel("${this.asset.name.replace(/-/g,
      "/")}", callback)`
      }
    ]);
  }

  view(asset) {
    var err, light, light2, s, scene, url;
    this.asset = asset;
    this.element.style.display = "block";
    this.updateSnippet();
    if (!this.initialized) {
      this.initialized = true;
      s = document.createElement("script");
      s.src = location.origin + "/lib/babylonjs/v4/babylon.js";
      document.head.appendChild(s);
      s.onload = () => {
        s = document.createElement("script");
        s.src = location.origin + "/lib/babylonjs/v4/babylonjs.loaders.min.js";
        document.head.appendChild(s);
        return s.onload = () => {
          return this.view(asset);
        };
      };
      return;
    }
    if (this.engine == null) {
      this.canvas = document.createElement("canvas");
      this.canvas.width = 1000;
      this.canvas.height = 800;
      this.engine = new BABYLON.Engine(this.canvas, true, {
        preserveDrawingBuffer: true
      });
      this.element.appendChild(this.canvas);
      window.addEventListener("resize", () => {
        return this.resize();
      });
    }
    scene = new BABYLON.Scene(this.engine);
    scene.clearColor = new BABYLON.Color3(.1, .2, .3);
    light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.groundColor = new BABYLON.Color3(0, 0, 0);
    light.diffuse = new BABYLON.Color3(.4, .5, .6);
    light.intensity = .5;
    light2 = new BABYLON.DirectionalLight("light2", new BABYLON.Vector3(1, -1, 1), scene);
    light2.specular = light2.diffuse = new BABYLON.Color3(1, .9, .7);
    light2.intensity = .5;
    // box = BABYLON.MeshBuilder.CreateBox("box", {}, scene)
    this.createEnvironment(scene);
    url = asset.getURL();
    if (url.startsWith("data:")) {
      url = "data:;base64," + url.split(",")[1];
    }
    try {
      // BABYLON.OBJFileLoader.COMPUTE_NORMALS = true
      BABYLON.SceneLoader.LoadAssetContainer("", url, scene, ((container) => {
        var boundingInfo, bs, center, i, j, len, len1, m, max, mesh, min, radius, ref, ref1, size;
        console.info("model loaded");
        console.info(container);
        container.addAllToScene();
        ref = container.meshes;
        for (i = 0, len = ref.length; i < len; i++) {
          m = ref[i];
          bs = m.getBoundingInfo().boundingBox;
          if (typeof min === "undefined" || min === null) {
            min = new BABYLON.Vector3();
            min.copyFrom(bs.minimum);
          }
          if (typeof max === "undefined" || max === null) {
            max = new BABYLON.Vector3();
            max.copyFrom(bs.maximum);
          }
          min = BABYLON.Vector3.Minimize(min, bs.minimum);
          max = BABYLON.Vector3.Maximize(max, bs.maximum);
        }
        size = max.subtract(min);
        boundingInfo = new BABYLON.BoundingInfo(min, max);
        center = boundingInfo.boundingBox.centerWorld;
        // m = BABYLON.MeshBuilder.CreateBox("bounds", {size:1}, scene)
        // m.scaling.copyFrom(size)
        // m.position.copyFrom(center)
        // m.visibility = 0.1
        console.log("Width: ", size.x);
        console.log("Height: ", size.y);
        console.log("Depth: ", size.z);
        console.log("Position: ", center);
        radius = max.subtract(min).length();
        console.info("RADIUS = " + radius);
        this.camera = new BABYLON.ArcRotateCamera("camera", Math.PI / 2, Math.PI / 2.5, radius, new BABYLON.Vector3(0, 0, 0), scene);
        this.camera.attachControl(this.canvas, true);
        this.camera.lowerRadiusLimit = radius / 10;
        this.camera.upperRadiusLimit = radius * 10;
        this.camera.maxZ = radius * 100;
        this.camera.minZ = radius / 100;
        this.camera.wheelDeltaPercentage = .01;
        window.camera = this.camera;
        this.camera.setTarget(center);
        window.container = container;
        if (asset.ext === "obj") {
          ref1 = container.meshes;
          for (j = 0, len1 = ref1.length; j < len1; j++) {
            mesh = ref1[j];
            mesh.material = new BABYLON.StandardMaterial("pbrmat", scene);
            mesh.material.diffuseColor = new BABYLON.Color3(1, 1, 1);
            mesh.material.specularColor = new BABYLON.Color3(0, 0, 0);
            mesh.material.emissiveColor = new BABYLON.Color3(0, 0, 0);
            mesh.material.ambientColor = new BABYLON.Color3(.1, .1, .1);
          }
        }
        return this.engine.runRenderLoop(() => {
          return scene.render();
        });
      }), ((progress) => {
        return console.info(progress);
      }), ((error) => {
        return console.info(error);
      }), `.${asset.ext}`);
    } catch (error1) {
      err = error1;
    }
    this.resize();
    this.asset = asset;
    return setTimeout((() => {
      return this.manager.checkThumbnail(asset, () => {
        return this.updateThumbnail();
      });
    }), 2000);
  }

  updateThumbnail() {
    var canvas, context, h, m, w;
    canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 96;
    context = canvas.getContext("2d");
    context.save();
    context.translate(64, 48);
    m = Math.min(this.canvas.width / 128 * 96, this.canvas.height);
    w = this.canvas.width / m * 128;
    h = this.canvas.height / m * 96;
    return BABYLON.Tools.CreateScreenshot(this.engine, this.camera, {
      width: w,
      height: h
    }, (data) => {
      var image;
      image = new Image;
      image.src = data;
      return image.onload = () => {
        context.drawImage(image, -image.width / 2, -image.height / 2);
        context.restore();
        return this.manager.updateAssetIcon(this.asset, canvas);
      };
    });
  }

  resize() {
    var h, w;
    if (this.canvas) {
      w = this.canvas.parentNode.getBoundingClientRect().width;
      h = this.canvas.parentNode.getBoundingClientRect().height;
      this.canvas.width = w;
      this.canvas.height = h;
    }
    if (this.engine != null) {
      return this.engine.resize();
    }
  }

  createEnvironment(scene) {
    var createFace, files, texture;
    createFace = function(c1, c2) {
      var c, canvas, grd;
      canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      c = canvas.getContext("2d");
      if (c2 != null) {
        // c.fillStyle = c1
        // c.fillRect 0,0,canvas.width,canvas.height/2
        // c.fillStyle = c2
        // c.fillRect 0,canvas.height/2,canvas.width,canvas.height/2
        c.fillStyle = grd = c.createLinearGradient(0, 0, 0, canvas.height);
        grd.addColorStop(0, c1);
        grd.addColorStop(.48, c1);
        grd.addColorStop(.52, c2);
        grd.addColorStop(1, c2);
        c.fillRect(0, 0, canvas.width, canvas.height);
      } else {
        c.fillStyle = c1;
        c.fillRect(0, 0, canvas.width, canvas.height);
      }
      return canvas.toDataURL();
    };
    files = [createFace("#ACE", "#864"), createFace("#BDF"), createFace("#ACE", "#864"), createFace("#ACE", "#864"), createFace("#201818"), createFace("#ACE", "#864")];
    texture = BABYLON.CubeTexture.CreateFromImages(files, scene);
    return scene.environmentTexture = texture;
  }

};

//console.info scene.createDefaultSkybox(texture, true, 1000)

this.ImageViewer = (function() {
  function ImageViewer(manager) {
    this.manager = manager;
    this.element = document.getElementById("image-asset-viewer");
  }

  ImageViewer.prototype.updateSnippet = function() {
    return this.manager.code_snippet.set([
      {
        name: "Load Image",
        value: "image = asset_manager.loadImage(\"" + (this.asset.name.replace(/-/g, "/")) + "\", callback)"
      }
    ]);
  };

  ImageViewer.prototype.view = function(asset) {
    this.element.style.display = "block";
    this.asset = asset;
    this.updateSnippet();
    this.element.style["background-image"] = "url(" + (asset.getURL()) + ") ";
    return this.manager.checkThumbnail(asset, (function(_this) {
      return function() {
        return _this.createThumbnail(asset.getURL(), function(canvas) {
          if (asset.element != null) {
            asset.element.querySelector("img").src = canvas.toDataURL();
          }
          return _this.manager.updateAssetIcon(asset, canvas);
        });
      };
    })(this));
  };

  ImageViewer.prototype.createThumbnail = function(url, callback) {
    var img;
    img = new Image;
    img.src = url;
    return img.onload = (function(_this) {
      return function() {
        var canvas, context, r;
        canvas = document.createElement("canvas");
        canvas.width = 128;
        canvas.height = 96;
        context = canvas.getContext("2d");
        context.save();
        context.fillStyle = "#222";
        context.fillRect(0, 0, canvas.width, canvas.height);
        r = Math.max(canvas.width / img.width, canvas.height / img.height);
        context.translate(canvas.width / 2, canvas.height / 2);
        context.drawImage(img, -r * img.width / 2, -r * img.height / 2, r * img.width, r * img.height);
        return callback(canvas);
      };
    })(this);
  };

  return ImageViewer;

})();

this.TextViewer = class TextViewer {
  constructor(manager) {
    this.manager = manager;
    this.element = document.getElementById("text-asset-viewer");
    this.app = this.manager.app;
    this.save_delay = 3000;
    this.save_time = 0;
    setInterval((() => {
      return this.checkSave();
    }), this.save_delay / 2);
  }

  updateSnippet() {
    switch (this.asset.ext) {
      case "json":
        return this.manager.code_snippet.set([
          {
            name: "Load JSON as object",
            value: `loader = asset_manager.loadJSON("${this.asset.name.replace(/-/g,
          "/")}", callback)`
          }
        ]);
      case "csv":
        return this.manager.code_snippet.set([
          {
            name: "Load CSV file as text",
            value: `loader = asset_manager.loadCSV("${this.asset.name.replace(/-/g,
          "/")}", callback)`
          }
        ]);
      case "txt":
        return this.manager.code_snippet.set([
          {
            name: "Load text file",
            value: `loader = asset_manager.loadText("${this.asset.name.replace(/-/g,
          "/")}", callback)`
          }
        ]);
    }
  }

  view(asset) {
    this.checkSave(true);
    this.element.style.display = "block";
    this.asset = asset;
    this.updateSnippet();
    if (!this.initialized) {
      this.initialized = true;
      this.editor = ace.edit("text-asset-viewer");
      this.editor.$blockScrolling = 2e308;
      this.editor.setTheme("ace/theme/tomorrow_night_bright");
      this.editor.setFontSize("12px");
      this.editor.setReadOnly(false);
      this.editor.getSession().on("change", () => {
        return this.editorContentsChanged();
      });
    }
    switch (asset.ext) {
      case "json":
        this.editor.getSession().setMode("ace/mode/json");
        break;
      case "md":
        this.editor.getSession().setMode("ace/mode/markdown");
        break;
      default:
        this.editor.getSession().setMode("ace/mode/text");
    }
    if (asset.local_text != null) {
      return this.setText(asset, asset.local_text, asset.ext);
    } else {
      return fetch(asset.getURL()).then((result) => {
        return result.text().then((text) => {
          return this.setText(asset, text, asset.ext);
        });
      });
    }
  }

  setText(asset, text, ext) {
    var err;
    this.ignore_changes = true;
    //@updateCurrentFileLock()
    if (ext === "json") {
      try {
        text = JSON.stringify(JSON.parse(text), null, '\t');
      } catch (error) {
        err = error;
        console.error(err);
      }
    }
    this.editor.setValue(text, -1);
    this.editor.getSession().setUndoManager(new ace.UndoManager());
    this.manager.checkThumbnail(asset, () => {
      var canvas;
      console.info("Must create thumbnail");
      canvas = this.createThumbnail(text, ext);
      if (asset.element != null) {
        asset.element.querySelector("img").src = canvas.toDataURL();
      }
      return this.manager.updateAssetIcon(asset, canvas);
    });
    return this.ignore_changes = false;
  }

  createThumbnail(text, ext) {
    var canvas, color, context, grd, i, lines;
    canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 96;
    context = canvas.getContext("2d");
    context.save();
    context.fillStyle = "#222";
    context.fillRect(0, 0, canvas.width, canvas.height);
    color = (function() {
      switch (ext) {
        case "json":
          return "hsl(0,50%,60%)";
        case "csv":
          return "hsl(60,50%,60%)";
        default:
          return "hsl(160,50%,60%)";
      }
    })();
    grd = context.createLinearGradient(0, 0, 0, 96);
    grd.addColorStop(0, color);
    grd.addColorStop(1, "#222");
    context.fillStyle = grd;
    context.rect(4, 4, 120, 120);
    context.clip();
    context.font = "5pt Verdana";
    lines = text.split("\n");
    i = 0;
    while (i < lines.length && i < 10) {
      context.fillText(lines[i], 4, 10 + i * 8);
      i += 1;
    }
    context.restore();
    return canvas;
  }

  editorContentsChanged() {
    document.getElementById("text-asset-viewer").style.removeProperty("background");
    if (this.ignore_changes) {
      return;
    }
    this.update_time = Date.now();
    this.save_time = Date.now();
    this.app.project.addPendingChange(this);
    if (this.asset != null) {
      this.app.project.lockFile(`assets/${this.asset.filename}`);
      return this.asset.content = this.editor.getValue();
    }
  }

  checkSave(immediate = false, callback) {
    if (this.save_time > 0 && (immediate || Date.now() > this.save_time + this.save_delay)) {
      this.saveFile(callback);
      return this.save_time = 0;
    }
  }

  forceSave(callback) {
    return this.checkSave(true, callback);
  }

  saveFile(callback) {
    var err, json, saved;
    saved = false;
    if (this.asset.ext === "json") {
      try {
        json = JSON.parse(this.asset.content);
        console.info("JSON parsed successfully");
      } catch (error) {
        err = error;
        document.getElementById("text-asset-viewer").style.background = "#600";
        return;
      }
    }
    this.app.client.sendRequest({
      name: "write_project_file",
      project: this.app.project.id,
      file: `assets/${this.asset.filename}`,
      content: this.asset.content
    }, (msg) => {
      saved = true;
      if (this.save_time === 0) {
        this.app.project.removePendingChange(this);
      }
      this.asset.size = msg.size;
      if (callback != null) {
        return callback();
      }
    });
    return setTimeout((() => {
      if (!saved) {
        this.save_time = Date.now();
        return console.info("retrying code save...");
      }
    }), 10000);
  }

};

this.FontViewer = (function() {
  function FontViewer(manager) {
    this.manager = manager;
    this.element = document.getElementById("font-asset-viewer");
  }

  FontViewer.prototype.updateSnippet = function() {
    return this.manager.code_snippet.set([
      {
        name: "Load Font",
        value: "asset_manager.loadFont(\"" + (this.asset.name.replace(/-/g, "/")) + "\")"
      }, {
        name: "Use Font",
        value: "screen.setFont(\"" + this.asset.shortname + "\")"
      }
    ]);
  };

  FontViewer.prototype.view = function(asset) {
    var font;
    this.asset = asset;
    this.element.style.display = "block";
    this.element.innerHTML = "";
    this.updateSnippet();
    font = new FontFace(asset.shortname, "url(" + (asset.getURL()) + ")");
    return font.load().then((function(_this) {
      return function() {
        document.fonts.add(font);
        _this.element.style["font-family"] = asset.shortname;
        _this.element.innerHTML = "<h1>" + asset.shortname + "</h1>\n<h2>ABCDEFGHIJKLMNOPQRSTUVWXYZ</h2>\n<h2>abcdefghijklmnopqrstuvwxyz</h2>\n<h2>0123456789</h2>\n<p>ABCDEFGHIJKLMNOPQRSTUVWXYZ</p>\n<p>abcdefghijklmnopqrstuvwxyz</p>\n<p>0123456789</p>";
        return _this.manager.checkThumbnail(asset, function() {
          var canvas, context, size;
          console.info("Must create thumbnail");
          canvas = document.createElement("canvas");
          canvas.width = 128;
          canvas.height = 96;
          context = canvas.getContext("2d");
          context.save();
          context.fillStyle = "hsl(200,50%,85%)";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.fillStyle = "rgba(0,0,0,.75)";
          context.rect(0, 0, 124, 92);
          context.clip();
          context.font = "12pt " + asset.shortname;
          context.fillText("ABCDEFGHIJKL", 4, 36);
          context.fillText("abcdefghijkl", 4, 54);
          context.fillText("0123456789", 4, 72);
          size = 11;
          while (size > 6 && context.measureText(asset.shortname).width > 120) {
            size -= 1;
            context.font = size + "pt " + asset.shortname;
          }
          context.fillText(asset.shortname, 4, 14);
          context.restore();
          if (asset.element != null) {
            asset.element.querySelector("img").src = canvas.toDataURL();
          }
          return _this.manager.updateAssetIcon(asset, canvas);
        });
      };
    })(this));
  };

  return FontViewer;

})();

this.SoundEditor = class SoundEditor extends Manager {
  constructor(app) {
    super(app);
    this.folder = "sounds";
    this.item = "sound";
    this.list_change_event = "soundlist";
    this.get_item = "getSound";
    this.use_thumbnails = true;
    this.extensions = ["wav", "ogg", "flac"];
    this.update_list = "updateSoundList";
    this.init();
  }

  update() {
    var f, img, img2;
    super.update();
    if (!this.img_loaded) {
      this.img_loaded = true;
      img = new Image();
      img.src = "/img/mpu/mpums1.jpg";
      document.getElementById("sample-editor-bg").appendChild(img);
      img.style = "position: absolute; width: 70%; bottom: 0; left:0; cursor: pointer";
      img2 = new Image();
      img2.src = "/img/mpu/mpums2.png";
      document.getElementById("sample-editor-content").appendChild(img2);
      img2.style = "position: absolute; height: 60%; bottom: 20px; right:20px; cursor: pointer";
      f = function() {
        return window.open("https://store.steampowered.com/app/2246370/Music_Power_Up/?utm_source=microstudio", "_blank");
      };
      img.addEventListener("click", f);
      return img2.addEventListener("click", f);
    }
  }

  openItem(name) {
    var sound;
    super.openItem(name);
    sound = this.app.project.getSound(name);
    if (sound != null) {
      return sound.play();
    }
  }

  createAsset(folder) {
    var input;
    input = document.createElement("input");
    input.type = "file";
    input.accept = ".wav,.ogg,.flac";
    input.addEventListener("change", (event) => {
      var f, files, i, len;
      files = event.target.files;
      if (files.length >= 1) {
        for (i = 0, len = files.length; i < len; i++) {
          f = files[i];
          this.fileDropped(f, folder);
        }
      }
    });
    return input.click();
  }

  fileDropped(file, folder) {
    var reader;
    console.info(`processing ${file.name}`);
    console.info("folder: " + folder);
    reader = new FileReader();
    reader.addEventListener("load", () => {
      var audioContext, file_size;
      file_size = reader.result.byteLength;
      console.info("file read, size = " + file_size);
      if (file_size > 30000000) { // client side limit 30 Mb
        this.app.appui.showNotification(this.app.translator.get("Audio file is too heavy"));
        return;
      }
      audioContext = new AudioContext();
      return audioContext.decodeAudioData(reader.result, (decoded) => {
        var ext, name, r2, sound, thumbnailer;
        console.info(decoded);
        thumbnailer = new SoundThumbnailer(decoded, 96, 64);
        name = file.name.split(".")[0];
        ext = file.name.split(".")[1].toLowerCase();
        name = this.findNewFilename(name, "getSound", folder);
        if (folder != null) {
          name = folder.getFullDashPath() + "-" + name;
        }
        if (folder != null) {
          folder.setOpen(true);
        }
        sound = this.app.project.createSound(name, thumbnailer.canvas.toDataURL(), file_size);
        sound.uploading = true;
        this.setSelectedItem(name);
        r2 = new FileReader();
        r2.addEventListener("load", () => {
          var data;
          sound.local_url = r2.result;
          data = r2.result.split(",")[1];
          this.app.project.addPendingChange(this);
          return this.app.client.sendRequest({
            name: "write_project_file",
            project: this.app.project.id,
            file: `sounds/${name}.${ext}`,
            properties: {},
            content: data,
            thumbnail: thumbnailer.canvas.toDataURL().split(",")[1]
          }, (msg) => {
            console.info(msg);
            this.app.project.removePendingChange(this);
            sound.uploading = false;
            this.app.project.updateSoundList();
            return this.checkNameFieldActivation();
          });
        });
        return r2.readAsDataURL(file);
      });
    });
    return reader.readAsArrayBuffer(file);
  }

};

this.SoundThumbnailer = (function() {
  function SoundThumbnailer(buffer, width, height, color) {
    this.buffer = buffer;
    this.width = width != null ? width : 128;
    this.height = height != null ? height : 64;
    this.color = color != null ? color : "hsl(20,80%,60%)";
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.channels = Math.min(2, this.buffer.numberOfChannels);
    this.context = this.canvas.getContext("2d");
    this.context.fillStyle = "#222";
    this.context.fillRect(0, 0, this.width, this.height);
    this.context.fillStyle = this.color;
    switch (this.channels) {
      case 1:
        this.context.translate(0, this.height / 2);
        this.drawChannel(this.buffer.getChannelData(0));
        break;
      case 2:
        this.context.translate(0, this.height / 4);
        this.context.scale(1, .5);
        this.drawChannel(this.buffer.getChannelData(0));
        this.context.translate(0, this.height);
        this.drawChannel(this.buffer.getChannelData(1));
    }
  }

  SoundThumbnailer.prototype.drawChannel = function(data) {
    var d, i, j, max, ref;
    max = 0;
    for (i = j = 0, ref = this.width - 1; j <= ref; i = j += .5) {
      d = Math.abs(data[Math.floor(data.length * i / this.width)]);
      max = Math.max(d, max);
      this.context.fillRect(i, -this.height / 2 * d, 1, this.height * d);
    }
    return console.info("max signal: " + max);
  };

  return SoundThumbnailer;

})();

this.MusicEditor = class MusicEditor extends Manager {
  constructor(app) {
    super(app);
    this.folder = "music";
    this.item = "music";
    this.list_change_event = "musiclist";
    this.get_item = "getMusic";
    this.use_thumbnails = true;
    this.extensions = ["mp3", "ogg", "flac"];
    this.update_list = "updateMusicList";
    this.init();
  }

  update() {
    var f, img, img2;
    super.update();
    if (!this.img_loaded) {
      this.img_loaded = true;
      img = new Image();
      img.src = "/img/mpu/mpums1.jpg";
      document.getElementById("music-editor-bg").appendChild(img);
      img.style = "position: absolute; width: 70%; bottom: 0; left:0; cursor: pointer";
      img2 = new Image();
      img2.src = "/img/mpu/mpums2.png";
      document.getElementById("music-editor-content").appendChild(img2);
      img2.style = "position: absolute; height: 60%; bottom: 20px; right:20px; cursor: pointer";
      f = function() {
        return window.open("https://store.steampowered.com/app/2246370/Music_Power_Up/?utm_source=microstudio", "_blank");
      };
      img.addEventListener("click", f);
      return img2.addEventListener("click", f);
    }
  }

  openItem(name) {
    var music;
    super.openItem(name);
    music = this.app.project.getMusic(name);
    if (music != null) {
      return music.play();
    }
  }

  createAsset(folder) {
    var input;
    input = document.createElement("input");
    input.type = "file";
    input.accept = ".mp3,.ogg,.flac";
    input.addEventListener("change", (event) => {
      var f, files, i, len;
      files = event.target.files;
      if (files.length >= 1) {
        for (i = 0, len = files.length; i < len; i++) {
          f = files[i];
          this.fileDropped(f, folder);
        }
      }
    });
    return input.click();
  }

  fileDropped(file, folder) {
    var reader;
    console.info(`processing ${file.name}`);
    reader = new FileReader();
    reader.addEventListener("load", () => {
      var audioContext, file_size;
      file_size = reader.result.byteLength;
      console.info("file read, size = " + file_size);
      if (file_size > 30000000) { // client-side limit to 30 Mb
        this.app.appui.showNotification(this.app.translator.get("Music file is too heavy"));
        return;
      }
      audioContext = new AudioContext();
      return audioContext.decodeAudioData(reader.result, (decoded) => {
        var ext, music, name, r2, thumbnailer;
        console.info(decoded);
        thumbnailer = new SoundThumbnailer(decoded, 192, 64, "hsl(200,80%,60%)");
        name = file.name.split(".")[0];
        ext = file.name.split(".")[1].toLowerCase();
        name = this.findNewFilename(name, "getMusic", folder);
        if (folder != null) {
          name = folder.getFullDashPath() + "-" + name;
        }
        if (folder != null) {
          folder.setOpen(true);
        }
        music = this.app.project.createMusic(name, thumbnailer.canvas.toDataURL(), file_size);
        music.uploading = true;
        this.setSelectedItem(name);
        r2 = new FileReader();
        r2.addEventListener("load", () => {
          var data;
          music.local_url = r2.result;
          data = r2.result.split(",")[1];
          this.app.project.addPendingChange(this);
          return this.app.client.sendRequest({
            name: "write_project_file",
            project: this.app.project.id,
            file: `music/${name}.${ext}`,
            properties: {},
            content: data,
            thumbnail: thumbnailer.canvas.toDataURL().split(",")[1]
          }, (msg) => {
            console.info(msg);
            this.app.project.removePendingChange(this);
            music.uploading = false;
            this.app.project.updateMusicList();
            return this.checkNameFieldActivation();
          });
        });
        return r2.readAsDataURL(file);
      });
    });
    return reader.readAsArrayBuffer(file);
  }

};

this.Undo = (function() {
  function Undo(listener) {
    this.listener = listener;
    this.states = [];
    this.next_state = 0;
    this.max = 30;
  }

  Undo.prototype.pushState = function(state) {
    if (this.next_state >= this.max) {
      this.states.splice(0, 1);
      this.next_state -= 1;
    }
    this.states[this.next_state++] = state;
    while (this.states.length > this.next_state) {
      this.states.splice(this.states.length - 1, 1);
    }
    return state;
  };

  Undo.prototype.empty = function() {
    return this.states.length === 0;
  };

  Undo.prototype.undo = function() {
    if (this.next_state - 2 >= 0 && this.next_state - 2 < this.states.length) {
      this.next_state -= 1;
      return this.states[this.next_state - 1];
    } else {
      return null;
    }
  };

  Undo.prototype.redo = function() {
    if (this.next_state >= 0 && this.next_state < this.states.length) {
      this.next_state += 1;
      return this.states[this.next_state - 1];
    } else {
      return null;
    }
  };

  return Undo;

})();

var Random;

Random = (function() {
  function Random(seed) {
    this.seed = seed != null ? seed : Math.random();
    if (this.seed < 1) {
      this.seed *= 1 << 30;
    }
    this.a = 13971;
    this.b = 12345;
    this.size = 1 << 30;
    this.mask = this.size - 1;
    this.norm = 1 / this.size;
    this.nextSeed();
    this.nextSeed();
    this.nextSeed();
  }

  Random.prototype.next = function() {
    this.seed = (this.seed * this.a + this.b) & this.mask;
    return this.seed * this.norm;
  };

  Random.prototype.nextInt = function(num) {
    return Math.floor(this.next() * num);
  };

  Random.prototype.nextSeed = function() {
    return this.seed = (this.seed * this.a + this.b) & this.mask;
  };

  Random.prototype.setSeed = function(seed) {
    this.seed = seed;
    if (this.seed < 1) {
      this.seed *= 1 << 30;
    }
    this.nextSeed();
    this.nextSeed();
    return this.nextSeed();
  };

  return Random;

})();

this.SplitBar = class SplitBar {
  constructor(id, type = "horizontal") {
    this.id = id;
    this.type = type;
    this.element = document.getElementById(this.id);
    if (!this.element) return;
    const children = Array.from(this.element.children);
    this.side1 = children[0];
    this.splitbar = children[1];
    this.side2 = children[2];
    if (!this.side1 || !this.splitbar || !this.side2) return;
    this.position = 50;
    this.closed1 = false;
    this.closed2 = false;
    this.splitbar_size = 10;
    this.splitbar.addEventListener("touchstart", (event) => {
      if ((event.touches != null) && (event.touches[0] != null)) {
        return this.startDrag(event.touches[0]);
      }
    });
    document.addEventListener("touchmove", (event) => {
      if ((event.touches != null) && (event.touches[0] != null)) {
        return this.drag(event.touches[0]);
      }
    });
    document.addEventListener("touchend", (event) => {
      return this.stopDrag();
    });
    document.addEventListener("touchcancel", (event) => {
      return this.stopDrag();
    });
    this.splitbar.addEventListener("mousedown", (event) => {
      return this.startDrag(event);
    });
    document.addEventListener("mousemove", (event) => {
      return this.drag(event);
    });
    document.addEventListener("mouseup", (event) => {
      return this.stopDrag(event);
    });
    window.addEventListener("resize", (event) => {
      return this.update();
    });
    this.update();
  }

  startDrag(event) {
    var e, i, len, list;
    this.dragging = true;
    this.drag_start_x = event.clientX;
    this.drag_start_y = event.clientY;
    this.drag_position = this.position;
    list = document.getElementsByTagName("iframe");
    for (i = 0, len = list.length; i < len; i++) {
      e = list[i];
      e.classList.add("ignoreMouseEvents");
    }
  }

  drag(event) {
    var dx, dy, ns;
    if (this.dragging) {
      switch (this.type) {
        case "horizontal":
          dx = (event.clientX - this.drag_start_x) / (this.element.clientWidth - this.splitbar.clientWidth) * 100;
          ns = Math.round(Math.max(0, Math.min(100, this.drag_position + dx)));
          if (ns !== this.position) {
            this.position = ns;
            window.dispatchEvent(new Event('resize'));
            return this.savePosition();
          }
          break;
        default:
          dy = (event.clientY - this.drag_start_y) / (this.element.clientHeight - this.splitbar.clientHeight) * 100;
          ns = Math.round(Math.max(0, Math.min(100, this.drag_position + dy)));
          if (ns !== this.position) {
            this.position = ns;
            window.dispatchEvent(new Event('resize'));
            return this.savePosition();
          }
      }
    }
  }

  stopDrag() {
    var e, i, len, list;
    this.dragging = false;
    list = document.getElementsByTagName("iframe");
    for (i = 0, len = list.length; i < len; i++) {
      e = list[i];
      e.classList.remove("ignoreMouseEvents");
    }
  }

  initPosition(default_position = 50) {
    var load;
    load = localStorage.getItem(`splitbar-${this.id}`);
    if ((load != null) && load >= 0 && load <= 100) {
      if (load >= 98 || load <= 2) {
        load = default_position;
      }
      return this.setPosition(load * 1, false);
    } else {
      return this.setPosition(default_position, false);
    }
  }

  setPosition(position, save = true) {
    this.position = position;
    this.update();
    if (save) {
      return this.savePosition();
    }
  }

  savePosition() {
    return localStorage.setItem(`splitbar-${this.id}`, this.position);
  }

  update() {
    var h, h1, h2, h3, w, w1, w2, w3;
    if (!this.element || !this.side1 || !this.splitbar || !this.side2) {
      return;
    }
    if (this.element.clientWidth === 0 || this.element.clientHeight === 0) {
      return;
    }
    if (this.auto != null) {
      if (this.element.clientWidth > this.element.clientHeight * this.auto) {
        this.type = "horizontal";
        this.splitbar.style.width = "10px";
        this.splitbar.style.height = "unset";
        this.splitbar.style.top = 0;
        this.splitbar.style.bottom = 0;
        this.splitbar.style.left = "unset";
        this.splitbar.style.right = "unset";
        this.splitbar.style.cursor = "ew-resize";
        this.side1.style.left = 0;
        this.side1.style.right = "unset";
        this.side1.style.height = "unset";
        this.side1.style.top = 0;
        this.side1.style.bottom = 0;
        this.side2.style.right = 0;
        this.side2.style.left = "unset";
        this.side2.style.height = "unset";
        this.side2.style.top = 0;
        this.side2.style.bottom = 0;
        this.side1.classList.remove("vertical-split");
        this.side1.classList.add("horizontal-split");
        this.side2.classList.remove("vertical-split");
        this.side2.classList.add("horizontal-split");
      } else {
        this.type = "vertical";
        this.splitbar.style.height = "10px";
        this.splitbar.style.width = "unset";
        this.splitbar.style.left = 0;
        this.splitbar.style.right = 0;
        this.splitbar.style.top = "unset";
        this.splitbar.style.bottom = "unset";
        this.splitbar.style.cursor = "ns-resize";
        this.side1.style.top = 0;
        this.side1.style.width = "unset";
        this.side1.style.bottom = "unset";
        this.side1.style.left = 0;
        this.side1.style.right = 0;
        this.side2.style.bottom = 0;
        this.side2.style.width = "unset";
        this.side2.style.top = "unset";
        this.side2.style.left = 0;
        this.side2.style.right = 0;
        this.side1.classList.add("vertical-split");
        this.side1.classList.remove("horizontal-split");
        this.side2.classList.add("vertical-split");
        this.side2.classList.remove("horizontal-split");
      }
    }
    switch (this.type) {
      case "horizontal":
        this.total_width = w = this.element.clientWidth - this.splitbar.clientWidth;
        if (this.closed2) {
          this.side1.style.width = this.element.clientWidth + "px";
          this.splitbar.style.display = "none";
          return this.side2.style.display = "none";
        } else if (this.closed1) {
          this.side2.style.width = this.element.clientWidth + "px";
          this.splitbar.style.display = "none";
          return this.side1.style.display = "none";
        } else {
          this.side1.style.display = "block";
          this.side2.style.display = "block";
          w1 = Math.min(Math.max(1, Math.round(this.position / 100 * w)), Math.round(w - 1));
          w2 = w1 + Math.max(this.splitbar.clientWidth, this.splitbar_size);
          w3 = this.element.clientWidth - w2;
          this.side1.style.width = w1 + "px";
          this.splitbar.style.left = w1 + "px";
          this.side2.style.width = w3 + "px";
          return this.splitbar.style.display = "block";
        }
        break;
      default:
        this.total_height = h = this.element.clientHeight - this.splitbar.clientHeight;
        h1 = Math.round(this.position / 100 * h);
        h2 = h1 + this.splitbar.clientHeight;
        h3 = this.element.clientHeight - h2;
        this.side1.style.height = h1 + "px";
        this.splitbar.style.top = h1 + "px";
        return this.side2.style.height = h3 + "px";
    }
  }

};

this.PixelArtScaler = (function() {
  function PixelArtScaler() {}

  PixelArtScaler.prototype.rescale = function(canvas, width, height) {
    var c, context;
    if (width > canvas.width || height > canvas.height) {
      return this.rescale(this.triplePix(canvas), width, height);
    } else {
      c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      context = c.getContext("2d");
      context.drawImage(canvas, 0, 0, width, height);
      return c;
    }
  };

  PixelArtScaler.prototype.distance = function(data, i1, i2) {
    var dw, dx, dy, dz;
    if (i1 * 4 > data.length || i2 * 4 > data.length || i1 < 0 || i2 < 0) {
      return 0;
    }
    dx = Math.abs(data[i1 * 4] - data[i2 * 4]);
    dy = Math.abs(data[i1 * 4 + 1] - data[i2 * 4 + 1]);
    dz = Math.abs(data[i1 * 4 + 2] - data[i2 * 4 + 2]);
    dw = Math.abs(data[i1 * 4 + 3] - data[i2 * 4 + 3]);
    return Math.max(dx, dy, dz, dw);
  };

  PixelArtScaler.prototype.inter = function(data, i1, i2, res, inter) {
    data[res * 4] = data[i1 * 4] * (1 - inter) + data[i2 * 4] * inter;
    data[res * 4 + 1] = data[i1 * 4 + 1] * (1 - inter) + data[i2 * 4 + 1] * inter;
    data[res * 4 + 2] = data[i1 * 4 + 2] * (1 - inter) + data[i2 * 4 + 2] * inter;
    return data[res * 4 + 3] = data[i1 * 4 + 3] * (1 - inter) + data[i2 * 4 + 3] * inter;
  };

  PixelArtScaler.prototype.inter4 = function(data, i1, i2, i3, i4, res, a, b) {
    data[res * 4] = (1 - b) * (data[i1 * 4] * (1 - a) + data[i2 * 4] * a) + b * (data[i3 * 4] * (1 - a) + data[i4 * 4] * a);
    data[res * 4 + 1] = (1 - b) * (data[i1 * 4 + 1] * (1 - a) + data[i2 * 4 + 1] * a) + b * (data[i3 * 4 + 1] * (1 - a) + data[i4 * 4 + 1] * a);
    data[res * 4 + 2] = (1 - b) * (data[i1 * 4 + 2] * (1 - a) + data[i2 * 4 + 2] * a) + b * (data[i3 * 4 + 2] * (1 - a) + data[i4 * 4 + 2] * a);
    return data[res * 4 + 3] = (1 - b) * (data[i1 * 4 + 3] * (1 - a) + data[i2 * 4 + 3] * a) + b * (data[i3 * 4 + 3] * (1 - a) + data[i4 * 4 + 3] * a);
  };

  PixelArtScaler.prototype.tripleSmoothing = function(canvas) {
    var context, d, d1, d2, data, dd1, dd2, diag1, diag2, i, i1, i2, i3, i4, j, k, l, m, n, o, p, q, r, ref, ref1, ref2, ref3, threshold;
    context = canvas.getContext("2d");
    data = context.getImageData(0, 0, canvas.width, canvas.height);
    threshold = 64;
    for (i = m = 1, ref = canvas.width - 4; m <= ref; i = m += 3) {
      for (j = n = 1, ref1 = canvas.height - 4; n <= ref1; j = n += 3) {
        i1 = i + j * canvas.width;
        i2 = (i + 3) + j * canvas.width;
        i3 = i + (j + 3) * canvas.width;
        i4 = (i + 3) + (j + 3) * canvas.width;
        d = this.distance(data.data, i1, i2) + this.distance(data.data, i3, i4) + this.distance(data.data, i1, i3) + this.distance(data.data, i2, i4);
        if (d < threshold * 2) {
          for (k = o = 0; o <= 3; k = o += 1) {
            for (l = p = 0; p <= 3; l = p += 1) {
              this.inter4(data.data, i1, i2, i3, i4, (i + k) + (j + l) * canvas.width, k / 3, l / 3);
            }
          }
        }
      }
    }
    for (i = q = 1, ref2 = canvas.width - 4; q <= ref2; i = q += 3) {
      for (j = r = 1, ref3 = canvas.height - 4; r <= ref3; j = r += 3) {
        i1 = i + j * canvas.width;
        i2 = (i + 3) + (j + 3) * canvas.width;
        i3 = i + 3 + j * canvas.width;
        i4 = i + (j + 3) * canvas.width;
        d1 = this.distance(data.data, i1, i2);
        d2 = this.distance(data.data, i3, i4);
        diag1 = !((i === canvas.width - 6 + 1 && j === 1) || (i === 1 && j === canvas.height - 6 + 1));
        diag2 = !((i === 1 && j === 1) || (i === canvas.width - 6 + 1 && j === canvas.height - 6 + 1));
        if (d1 < threshold && d2 >= threshold && diag1) {
          this.inter(data.data, i1, i2, (i + 2) + (j + 1) * canvas.width, .5);
          this.inter(data.data, i1, i2, (i + 1) + (j + 2) * canvas.width, .5);
          this.inter(data.data, i1, i2, (i + 1) + (j + 1) * canvas.width, 1 / 3);
          this.inter(data.data, i1, i2, (i + 2) + (j + 2) * canvas.width, 2 / 3);
          if (this.distance(data.data, i1, i1 - 3 * canvas.width) < threshold && this.distance(data.data, i3, i3 - 3 * canvas.width) < threshold) {
            this.inter(data.data, i1, i2, (i + 2) + j * canvas.width, .5);
          }
          if (this.distance(data.data, i2, i2 + 3 * canvas.width) < threshold && this.distance(data.data, i4, i4 + 3 * canvas.width) < threshold) {
            this.inter(data.data, i1, i2, (i + 1) + (j + 3) * canvas.width, .5);
          }
          if (this.distance(data.data, i1, i1 - 3) < threshold && this.distance(data.data, i4, i4 - 3) < threshold) {
            this.inter(data.data, i1, i2, i + (j + 2) * canvas.width, .5);
          }
          if (this.distance(data.data, i2, i2 + 3) < threshold && this.distance(data.data, i3, i3 + 3) < threshold) {
            this.inter(data.data, i1, i2, (i + 3) + (j + 1) * canvas.width, .5);
          }
        } else if (d2 < threshold && d1 >= threshold && diag2) {
          this.inter(data.data, i3, i4, (i + 1) + (j + 1) * canvas.width, .5);
          this.inter(data.data, i3, i4, (i + 2) + (j + 2) * canvas.width, .5);
          this.inter(data.data, i3, i4, (i + 2) + (j + 1) * canvas.width, 1 / 3);
          this.inter(data.data, i3, i4, (i + 1) + (j + 2) * canvas.width, 2 / 3);
          if (this.distance(data.data, i3, i3 - 3 * canvas.width) < threshold && this.distance(data.data, i1, i1 - 3 * canvas.width) < threshold) {
            this.inter(data.data, i3, i4, i3 - 2, .5);
          }
          if (this.distance(data.data, i4, i4 + 3 * canvas.width) < threshold && this.distance(data.data, i2, i2 + 3 * canvas.width) < threshold) {
            this.inter(data.data, i3, i4, i4 + 2, .5);
          }
          if (this.distance(data.data, i3, i3 + 3) < threshold && this.distance(data.data, i2, i2 + 3) < threshold) {
            this.inter(data.data, i3, i4, i3 + 2 * canvas.width, .5);
          }
          if (this.distance(data.data, i4, i4 - 3) < threshold && this.distance(data.data, i1, i1 - 3) < threshold) {
            this.inter(data.data, i3, i4, i4 - 2 * canvas.width, .5);
          }
        } else if (d1 < threshold && d2 < threshold) {
          dd1 = this.distance(data.data, i1, (i - 3) + j * canvas.width) + this.distance(data.data, i1, i + (j - 3) * canvas.width) + this.distance(data.data, i1, i + 6 + (j + 3) * canvas.width) + this.distance(data.data, i1, i + 3 + (j + 6) * canvas.width);
          dd2 = this.distance(data.data, i3, i - 3 + (j + 3) * canvas.width) + this.distance(data.data, i3, i + (j + 6) * canvas.width) + this.distance(data.data, i3, i + 3 + (j - 3) * canvas.width) + this.distance(data.data, i3, i + 6 + j * canvas.width);
          if (dd2 < dd1 && diag1) {
            this.inter(data.data, i1, i2, (i + 2) + (j + 1) * canvas.width, .5);
            this.inter(data.data, i1, i2, (i + 1) + (j + 2) * canvas.width, .5);
            this.inter(data.data, i1, i2, (i + 1) + (j + 1) * canvas.width, 1 / 3);
            this.inter(data.data, i1, i2, (i + 2) + (j + 2) * canvas.width, 2 / 3);
            if (this.distance(data.data, i1, i1 - 3 * canvas.width) < threshold && this.distance(data.data, i3, i3 - 3 * canvas.width) < threshold) {
              this.inter(data.data, i1, i2, (i + 2) + j * canvas.width, .5);
            }
            if (this.distance(data.data, i2, i2 + 3 * canvas.width) < threshold && this.distance(data.data, i4, i4 + 3 * canvas.width) < threshold) {
              this.inter(data.data, i1, i2, (i + 1) + (j + 3) * canvas.width, .5);
            }
            if (this.distance(data.data, i1, i1 - 3) < threshold && this.distance(data.data, i4, i4 - 3) < threshold) {
              this.inter(data.data, i1, i2, i + (j + 2) * canvas.width, .5);
            }
            if (this.distance(data.data, i2, i2 + 3) < threshold && this.distance(data.data, i3, i3 + 3) < threshold) {
              this.inter(data.data, i1, i2, (i + 3) + (j + 1) * canvas.width, .5);
            }
          } else if (dd1 < dd2 && diag2) {
            this.inter(data.data, i3, i4, (i + 1) + (j + 1) * canvas.width, .5);
            this.inter(data.data, i3, i4, (i + 2) + (j + 2) * canvas.width, .5);
            this.inter(data.data, i3, i4, (i + 2) + (j + 1) * canvas.width, 1 / 3);
            this.inter(data.data, i3, i4, (i + 1) + (j + 2) * canvas.width, 2 / 3);
            if (this.distance(data.data, i3, i3 - 3 * canvas.width) < threshold && this.distance(data.data, i1, i1 - 3 * canvas.width) < threshold) {
              this.inter(data.data, i3, i4, i3 - 2, .5);
            }
            if (this.distance(data.data, i4, i4 + 3 * canvas.width) < threshold && this.distance(data.data, i2, i2 + 3 * canvas.width) < threshold) {
              this.inter(data.data, i3, i4, i4 + 2, .5);
            }
            if (this.distance(data.data, i3, i3 + 3) < threshold && this.distance(data.data, i2, i2 + 3) < threshold) {
              this.inter(data.data, i3, i4, i3 + 2 * canvas.width, .5);
            }
            if (this.distance(data.data, i4, i4 - 3) < threshold && this.distance(data.data, i1, i1 - 3) < threshold) {
              this.inter(data.data, i3, i4, i4 - 2 * canvas.width, .5);
            }
          }
        }
      }
    }
    context.putImageData(data, 0, 0);
    return canvas;
  };

  PixelArtScaler.prototype.triplePix = function(canvas) {
    var c, context;
    c = document.createElement("canvas");
    c.width = (canvas.width + 2) * 3;
    c.height = (canvas.height + 2) * 3;
    context = c.getContext("2d");
    context.imageSmoothingEnabled = false;
    context.drawImage(canvas, 3, 3, c.width - 6, c.height - 6);
    this.tripleSmoothing(c);
    canvas = document.createElement("canvas");
    canvas.width = c.width - 6;
    canvas.height = c.height - 6;
    context = canvas.getContext("2d");
    context.drawImage(c, -3, -3);
    return canvas;
  };

  return PixelArtScaler;

})();

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

this.Debug = (function() {
  function Debug(app) {
    this.app = app;
    document.getElementById("open-debugger-button").addEventListener("click", (function(_this) {
      return function() {
        return _this.toggleDebugView();
      };
    })(this));
    document.getElementById("open-timemachine-button").addEventListener("click", (function(_this) {
      return function() {
        return _this.toggleTimeMachineView();
      };
    })(this));
    window.addEventListener("resize", (function(_this) {
      return function() {
        if (!_this.app.appui.debug_splitbar.closed2 && _this.app.appui.debug_splitbar.position >= 99) {
          return _this.toggleDebugView();
        }
      };
    })(this));
    this.watch = new Watch(this.app);
    this.time_machine = new TimeMachine(this.app);
  }

  Debug.prototype.toggleDebugView = function() {
    if (this.app.appui.debug_splitbar.closed2) {
      this.app.appui.debug_splitbar.closed2 = false;
      this.app.appui.debug_splitbar.position = Math.min(80, this.app.appui.debug_splitbar.position);
      this.watch.start();
    } else {
      this.app.appui.debug_splitbar.closed2 = true;
      this.watch.stop();
    }
    return this.app.appui.debug_splitbar.update();
  };

  Debug.prototype.toggleTimeMachineView = function() {
    if (this.time_machine_open) {
      this.time_machine_open = false;
      document.getElementById("debug-timemachine-bar").style.display = "none";
      document.getElementById("terminal-debug-container").style.top = "2px";
      return this.time_machine.closed();
    } else {
      this.time_machine_open = true;
      document.getElementById("debug-timemachine-bar").style.display = "block";
      return document.getElementById("terminal-debug-container").style.top = "42px";
    }
  };

  Debug.prototype.projectOpened = function() {
    return this.updateDebuggerVisibility();
  };

  Debug.prototype.updateDebuggerVisibility = function() {
    var timemachine;
    if (this.app.project != null) {
      timemachine = this.app.project.language.indexOf("microscript") >= 0 && this.app.project.graphics.toLowerCase() === "m1";
      document.getElementById("open-timemachine-button").style.display = timemachine ? "block" : "none";
      if (this.app.project.language.indexOf("microscript") >= 0) {
        return document.getElementById("open-debugger-button").style.display = "block";
      } else {
        document.getElementById("open-debugger-button").style.display = "none";
        if (!this.app.appui.debug_splitbar.closed2) {
          this.app.appui.debug_splitbar.closed2 = true;
          return this.app.appui.debug_splitbar.update();
        }
      }
    }
  };

  Debug.prototype.projectClosed = function() {
    this.watch.reset();
    if (this.time_machine_open) {
      return this.toggleTimeMachineView();
    }
  };

  return Debug;

})();

this.Watch = (function() {
  function Watch(app) {
    var fn, i, len, ref, t;
    this.app = app;
    this.runwindow = this.app.runwindow;
    this.runwindow.addMessageListener("watch_update", (function(_this) {
      return function(msg) {
        return _this.watchUpdate(msg);
      };
    })(this));
    this.types = ["number", "string", "function", "object", "list"];
    ref = this.types;
    fn = (function(_this) {
      return function(t) {
        _this["filtered_type_" + t] = false;
        return document.getElementById("debug-watch-type-" + t).addEventListener("click", function() {
          _this["filtered_type_" + t] = !_this["filtered_type_" + t];
          if (_this["filtered_type_" + t]) {
            document.getElementById("debug-watch-type-" + t).classList.add("filtered");
          } else {
            document.getElementById("debug-watch-type-" + t).classList.remove("filtered");
          }
          return _this.updateFilters();
        });
      };
    })(this);
    for (i = 0, len = ref.length; i < len; i++) {
      t = ref[i];
      fn(t);
    }
    document.getElementById("debug-watch-filter").addEventListener("input", (function(_this) {
      return function() {
        _this.text_filter = document.getElementById("debug-watch-filter").value;
        return _this.updateFilters();
      };
    })(this));
    this.reset();
    this.app.runwindow.addListener((function(_this) {
      return function(event) {
        return _this.runtimeEvent(event);
      };
    })(this));
  }

  Watch.prototype.reset = function() {
    this.watch_lines = {};
    this.watch_list = ["global"];
    this.text_filter = "";
    document.getElementById("debug-watch-filter").value = "";
    return document.getElementById("debug-watch-content").innerHTML = "";
  };

  Watch.prototype.start = function() {
    this.started = true;
    return this.runwindow.postMessage({
      name: "watch",
      list: this.watch_list
    });
  };

  Watch.prototype.stop = function() {
    this.started = false;
    return this.runwindow.postMessage({
      name: "stop_watching"
    });
  };

  Watch.prototype.addWatch = function(w) {
    console.info("adding watch: " + w);
    this.watch_list.push(w);
    this.watch_list_updated = true;
    return this.start();
  };

  Watch.prototype.removeWatch = function(w) {
    var index;
    console.info("removing watch: " + w);
    index = this.watch_list.indexOf(w);
    if (w.indexOf(".") > 0) {
      delete this.watch_lines[w];
    }
    if (index >= 0) {
      this.watch_list.splice(index, 1);
      return this.start();
    }
  };

  Watch.prototype.watchUpdate = function(msg) {
    var alive, data, e, key, ref, ref1, set_key, set_value, value;
    if (!this.started) {
      return;
    }
    data = msg.data;
    alive = {};
    for (set_key in data) {
      set_value = data[set_key];
      if (set_key !== "global") {
        if (this.watch_lines.hasOwnProperty(set_key)) {
          alive[set_key] = true;
          this.watch_lines[set_key].updateContents(set_value);
        }
      }
    }
    e = document.getElementById("debug-watch-content");
    ref = data.global;
    for (key in ref) {
      value = ref[key];
      if (this.watch_lines.hasOwnProperty(key)) {
        this.watch_lines[key].updateValue(value);
      } else {
        this.watch_lines[key] = new WatchLine(this, e, key, value);
      }
      alive[key] = true;
    }
    if (!this.watch_list_updated) {
      ref1 = this.watch_lines;
      for (key in ref1) {
        value = ref1[key];
        if (!alive[key]) {
          value.remove();
          e.removeChild(value.element);
          delete this.watch_lines[key];
        }
      }
    }
    this.watch_list_updated = false;
  };

  Watch.prototype.isFiltered = function(w) {
    var v;
    v = w.value;
    if (this["filtered_type_" + v.type]) {
      return true;
    }
    if ((this.text_filter != null) && this.text_filter.length > 0 && w.prefixed.indexOf(this.text_filter) < 0) {
      return true;
    }
    return false;
  };

  Watch.prototype.updateFilters = function() {
    var key, ref, results, value;
    ref = this.watch_lines;
    results = [];
    for (key in ref) {
      value = ref[key];
      results.push(value.filterUpdate());
    }
    return results;
  };

  Watch.prototype.runtimeEvent = function(event) {
    switch (event) {
      case "play":
      case "reload":
        return this.reset();
      case "started":
        if (!this.app.appui.debug_splitbar.closed2) {
          this.reset();
          return this.start();
        }
        break;
      case "exit":
        this.started = false;
        return this.reset();
    }
  };

  return Watch;

})();

this.WatchLine = (function() {
  function WatchLine(watch, parent_element, variable, value1, prefix) {
    this.watch = watch;
    this.parent_element = parent_element;
    this.variable = variable;
    this.value = value1;
    this.prefix = prefix;
    this.prefixed = this.prefix != null ? this.prefix + "." + this.variable : this.variable;
    this.element = document.createElement("div");
    this.element.classList.add("watch-line");
    this.element.innerHTML = "<div class=\"watch-line-name\"><i class=\"fa\"></i> " + this.variable + "</div>\n<div class=\"watch-line-value\">" + (this.textValue()) + "</div>";
    this.element.classList.add(this.value.type);
    this.parent_element.appendChild(this.element);
    this.element.querySelector(".watch-line-value").addEventListener("click", (function(_this) {
      return function() {
        return _this.editValue();
      };
    })(this));
    this.element.querySelector("i").addEventListener("click", (function(_this) {
      return function() {
        var ref;
        if ((ref = _this.value.type) === "object" || ref === "list") {
          if (!_this.open) {
            _this.open = true;
            _this.watch.addWatch(_this.prefixed);
            _this.watch.watch_lines[_this.prefixed] = _this;
            _this.element.classList.add("open");
            if (_this.content != null) {
              return _this.content.style.display = "block";
            }
          } else {
            _this.open = false;
            _this.watch.removeWatch(_this.prefixed);
            _this.element.classList.remove("open");
            _this.watch_lines = {};
            if (_this.content != null) {
              _this.element.removeChild(_this.content);
              return _this.content = null;
            }
          }
        }
      };
    })(this));
    this.hidden = false;
    this.filterUpdate();
    this.watch_lines = {};
  }

  WatchLine.prototype.remove = function() {
    this.watch.removeWatch(this.prefixed);
    this.watch_lines = {};
    if (this.content != null) {
      this.element.removeChild(this.content);
      this.content = null;
    }
    this.element.classList.remove("open");
    return this.open = false;
  };

  WatchLine.prototype.textValue = function() {
    switch (this.value.type) {
      case "string":
        return '"' + this.value.value + '"';
      case "function":
        return "function()";
      case "list":
        return "[list:" + this.value.length + "]";
      case "object":
        return this.value.value || "object .. end";
      default:
        return this.value.value;
    }
  };

  WatchLine.prototype.updateValue = function(value) {
    var ref;
    if (value.type !== this.value.type) {
      this.element.classList.remove(this.value.type);
      this.element.classList.add(value.type);
      this.value.type = value.type;
      if ((this.content != null) && ((ref = this.value.type) !== "object" && ref !== "list")) {
        this.remove();
      }
    }
    if (value.value !== this.value.value || value.length !== this.value.length) {
      this.value.value = value.value;
      this.value.length = value.length;
      return this.element.querySelector(".watch-line-value").innerText = this.textValue();
    }
  };

  WatchLine.prototype.updateContents = function(data) {
    var active, key, ref, results, value;
    if (!this.open) {
      return;
    }
    if (!this.content) {
      this.content = document.createElement("div");
      this.content.classList.add("watch-line-content");
      this.element.appendChild(this.content);
    }
    active = {};
    for (key in data) {
      value = data[key];
      if (this.watch_lines.hasOwnProperty(key)) {
        this.watch_lines[key].updateValue(value);
      } else {
        this.watch_lines[key] = new WatchLine(this.watch, this.content, key, value, this.prefixed);
      }
      active[key] = true;
    }
    ref = this.watch_lines;
    results = [];
    for (key in ref) {
      value = ref[key];
      if (!active[key]) {
        delete this.watch_lines[key];
        value.remove();
        if (this.content != null) {
          results.push(this.content.removeChild(value.element));
        } else {
          results.push(void 0);
        }
      } else {
        results.push(void 0);
      }
    }
    return results;
  };

  WatchLine.prototype.filterUpdate = function() {
    var key, ref, results, value;
    if (this.hidden !== this.watch.isFiltered(this)) {
      this.hidden = !this.hidden;
      this.element.style.display = this.hidden ? "none" : "block";
    }
    ref = this.watch_lines;
    results = [];
    for (key in ref) {
      value = ref[key];
      results.push(value.filterUpdate());
    }
    return results;
  };

  WatchLine.prototype.editValue = function() {
    var input;
    if (this.value.type === "number" || this.value.type === "string") {
      input = document.createElement("input");
      input.type = "text";
      input.value = this.value.value;
      this.element.appendChild(input);
      input.addEventListener("blur", (function(_this) {
        return function() {
          return _this.element.removeChild(input);
        };
      })(this));
      input.addEventListener("keydown", (function(_this) {
        return function(event) {
          var err;
          if (event.key === "Enter") {
            event.preventDefault();
            if (input.value !== _this.value.value) {
              try {
                if (_this.value.type === "number") {
                  if (isFinite(parseFloat(input.value))) {
                    _this.watch.app.runwindow.runCommand(_this.prefixed + " = " + input.value, function() {});
                  }
                } else if (_this.value.type === "string") {
                  _this.watch.app.runwindow.runCommand(_this.prefixed + " = \"" + input.value + "\" ", function() {});
                }
              } catch (error) {
                err = error;
                console.error(err);
              }
            }
            return input.blur();
          }
        };
      })(this));
      return input.focus();
    }
  };

  return WatchLine;

})();

this.TimeMachine = (function() {
  function TimeMachine(app) {
    this.app = app;
    document.getElementById("debug-timemachine-record").addEventListener("click", (function(_this) {
      return function() {
        return _this.toggleRecording();
      };
    })(this));
    document.getElementById("debug-timemachine-step-backward").addEventListener("click", (function(_this) {
      return function() {
        return _this.stepBackward();
      };
    })(this));
    document.getElementById("debug-timemachine-step-forward").addEventListener("click", (function(_this) {
      return function() {
        return _this.stepForward();
      };
    })(this));
    document.getElementById("debug-timemachine-backward").addEventListener("mousedown", (function(_this) {
      return function() {
        return _this.startBackward();
      };
    })(this));
    document.getElementById("debug-timemachine-forward").addEventListener("mousedown", (function(_this) {
      return function() {
        return _this.startForward();
      };
    })(this));
    document.getElementById("debug-timemachine-loop").addEventListener("click", (function(_this) {
      return function() {
        return _this.toggleLoop();
      };
    })(this));
    document.addEventListener("mouseup", (function(_this) {
      return function() {
        return _this.stopAll();
      };
    })(this));
    this.backwarding = false;
    this.forwarding = false;
    this.looping = false;
    this.app.runwindow.addListener((function(_this) {
      return function(event) {
        return _this.runtimeEvent(event);
      };
    })(this));
    document.getElementById("debug-timemachine-recorder-trail").addEventListener("mousedown", (function(_this) {
      return function(event) {
        _this.dragging = true;
        return _this.cursorAction(event);
      };
    })(this));
    document.addEventListener("mousemove", (function(_this) {
      return function(event) {
        if (_this.dragging) {
          return _this.cursorAction(event);
        }
      };
    })(this));
    document.addEventListener("mouseup", (function(_this) {
      return function() {
        return _this.dragging = false;
      };
    })(this));
    this.loop_length = 60 * 4;
  }

  TimeMachine.prototype.cursorAction = function(event) {
    var b, max, max_pos, replay_pos, x;
    if (this.record_status != null) {
      b = document.getElementById("debug-timemachine-recorder-trail").getBoundingClientRect();
      x = event.clientX - b.x;
      max = this.record_status.max + this.loop_length;
      max_pos = this.record_status.length / max * 160;
      replay_pos = (max_pos - x) / 160 * this.record_status.max;
      console.log(this.record_status);
      if (!this.app.runwindow.isPaused()) {
        this.app.runwindow.pause();
      }
      return this.app.runwindow.postMessage({
        name: "time_machine",
        command: "replay_position",
        position: replay_pos
      });
    }
  };

  TimeMachine.prototype.toggleRecording = function() {
    if (this.recording) {
      return this.stopRecording();
    } else {
      return this.startRecording();
    }
  };

  TimeMachine.prototype.startRecording = function() {
    this.stopLooping();
    this.app.runwindow.play();
    this.recording = true;
    this.app.runwindow.postMessage({
      name: "time_machine",
      command: "start_recording"
    });
    return document.getElementById("debug-timemachine-record").classList.add("recording");
  };

  TimeMachine.prototype.stopRecording = function() {
    this.recording = false;
    this.app.runwindow.postMessage({
      name: "time_machine",
      command: "stop_recording"
    });
    return document.getElementById("debug-timemachine-record").classList.remove("recording");
  };

  TimeMachine.prototype.toggleLoop = function() {
    if (!this.looping) {
      return this.startLooping();
    } else {
      return this.stopLooping();
    }
  };

  TimeMachine.prototype.startLooping = function() {
    if (!this.app.runwindow.isPaused()) {
      this.app.runwindow.pause();
    }
    this.stopRecording();
    this.looping = true;
    this.app.runwindow.postMessage({
      name: "time_machine",
      command: "start_looping"
    });
    return document.getElementById("debug-timemachine-loop").classList.add("looping");
  };

  TimeMachine.prototype.stopLooping = function() {
    if (this.looping) {
      this.looping = false;
      this.app.runwindow.postMessage({
        name: "time_machine",
        command: "stop_looping"
      });
      return document.getElementById("debug-timemachine-loop").classList.remove("looping");
    }
  };

  TimeMachine.prototype.stepBackward = function() {
    this.stopLooping();
    if (!this.app.runwindow.isPaused()) {
      this.app.runwindow.pause();
    }
    return this.app.runwindow.postMessage({
      name: "time_machine",
      command: "step_backward"
    });
  };

  TimeMachine.prototype.stepForward = function() {
    this.stopLooping();
    if (!this.app.runwindow.isPaused()) {
      this.app.runwindow.pause();
    }
    return this.app.runwindow.postMessage({
      name: "time_machine",
      command: "step_forward"
    });
  };

  TimeMachine.prototype.startBackward = function() {
    this.stopLooping();
    if (!this.app.runwindow.isPaused()) {
      this.app.runwindow.pause();
    }
    this.backwarding = true;
    return requestAnimationFrame((function(_this) {
      return function() {
        return _this.backward();
      };
    })(this));
  };

  TimeMachine.prototype.startForward = function() {
    this.stopLooping();
    if (!this.app.runwindow.isPaused()) {
      this.app.runwindow.pause();
    }
    this.forwarding = true;
    return requestAnimationFrame((function(_this) {
      return function() {
        return _this.forward();
      };
    })(this));
  };

  TimeMachine.prototype.backward = function() {
    if (!this.backwarding) {
      return;
    }
    requestAnimationFrame((function(_this) {
      return function() {
        return _this.backward();
      };
    })(this));
    return this.app.runwindow.postMessage({
      name: "time_machine",
      command: "step_backward"
    });
  };

  TimeMachine.prototype.forward = function() {
    if (!this.forwarding) {
      return;
    }
    requestAnimationFrame((function(_this) {
      return function() {
        return _this.forward();
      };
    })(this));
    return this.app.runwindow.postMessage({
      name: "time_machine",
      command: "step_forward"
    });
  };

  TimeMachine.prototype.stopAll = function() {
    this.backwarding = false;
    return this.forwarding = false;
  };

  TimeMachine.prototype.messageReceived = function(msg) {
    var head, length, max;
    switch (msg.command) {
      case "status":
        length = msg.length;
        head = msg.head;
        max = msg.max;
        this.setPosition(length, head, max);
        return this.record_status = msg;
    }
  };

  TimeMachine.prototype.setPosition = function(length, head, max) {
    var percent;
    max += this.loop_length;
    percent = 100 * length / max;
    document.getElementById("debug-timemachine-recorder-trail").style.background = "linear-gradient(90deg, hsl(180,100%,20%) 0%, hsl(180,100%,10%) " + percent + "%,rgba(0,0,0,.1) " + percent + "%,rgba(0,0,0,.1) 100%)";
    document.getElementById("debug-timemachine-recorder-head").style.left = (head / max * 160 - 5) + "px";
    if (this.recording && !this.app.runwindow.isPaused()) {
      return document.getElementById("debug-timemachine-recorder-head").style.transform = "scale(" + (1 + Math.sin(Date.now() / 200) * .1) + ",1)";
    } else {
      return document.getElementById("debug-timemachine-recorder-head").style.transform = "scale(1,1)";
    }
  };

  TimeMachine.prototype.reset = function() {
    this.stopLooping();
    return setTimeout(((function(_this) {
      return function() {
        return _this.setPosition(0, 0, 1000);
      };
    })(this)), 16);
  };

  TimeMachine.prototype.closed = function() {
    this.reset();
    this.stopRecording();
    return this.stopAll();
  };

  TimeMachine.prototype.runtimeEvent = function(event) {
    switch (event) {
      case "play":
      case "reload":
        return this.reset();
      case "resume":
        return this.stopLooping();
      case "started":
        if (this.recording) {
          return this.startRecording();
        }
        break;
      case "exit":
        return this.reset();
    }
  };

  return TimeMachine;

})();

this.Terminal = class Terminal {
  constructor(runwindow, tid = "terminal") {
    this.runwindow = runwindow;
    this.tid = tid;
    this.localStorage = localStorage;
    this.commands = {
      clear: () => {
        return this.clear();
      }
    };
    this.loadHistory();
    this.buffer = [];
    this.length = 0;
    this.error_lines = 0;
  }

  loadHistory() {
    var err;
    this.history = [];
    try {
      if (this.localStorage.getItem("console_history") != null) {
        return this.history = JSON.parse(this.localStorage.getItem("console_history"));
      }
    } catch (error) {
      err = error;
    }
  }

  saveHistory() {
    return this.localStorage.setItem("console_history", JSON.stringify(this.history));
  }

  start() {
    if (this.started) {
      return;
    }
    this.started = true;
    document.getElementById(`${this.tid}`).addEventListener("mousedown", (event) => {
      this.pressed = true;
      this.moved = false;
      return true;
    });
    document.getElementById(`${this.tid}`).addEventListener("mousemove", (event) => {
      if (this.pressed) {
        this.moved = true;
      }
      return true;
    });
    document.getElementById(`${this.tid}`).addEventListener("mouseup", (event) => {
      if (!this.moved) {
        document.getElementById(`${this.tid}-input`).focus();
      }
      this.moved = false;
      this.pressed = false;
      return true;
    });
    document.getElementById(`${this.tid}-input`).addEventListener("paste", (event) => {
      var j, len, line, s, text;
      text = event.clipboardData.getData("text/plain");
      s = text.split("\n");
      if (s.length > 1) {
        event.preventDefault();
        for (j = 0, len = s.length; j < len; j++) {
          line = s[j];
          document.getElementById(`${this.tid}-input`).value = "";
          this.validateLine(line);
        }
      } else {
        return false;
      }
    });
    //document.getElementById("#{@tid}-input").value = s[0]
    document.getElementById(`${this.tid}-input`).addEventListener("keydown", (event) => {
      var v;
      // console.info event.key
      if (event.key === "Enter") {
        v = document.getElementById(`${this.tid}-input`).value;
        document.getElementById(`${this.tid}-input`).value = "";
        this.validateLine(v);
        return this.force_scroll = true;
      } else if (event.key === "ArrowUp") {
        if (this.history_index == null) {
          this.history_index = this.history.length - 1;
          this.current_input = document.getElementById(`${this.tid}-input`).value;
        } else {
          this.history_index = Math.max(0, this.history_index - 1);
        }
        if (this.history_index === this.history.length - 1) {
          this.current_input = document.getElementById(`${this.tid}-input`).value;
        }
        if (this.history_index >= 0 && this.history_index < this.history.length) {
          document.getElementById(`${this.tid}-input`).value = this.history[this.history_index];
          return this.setTrailingCaret();
        }
      } else if (event.key === "ArrowDown") {
        if (this.history_index === this.history.length) {
          return;
        }
        if (this.history_index != null) {
          this.history_index = Math.min(this.history.length, this.history_index + 1);
        } else {
          return;
        }
        if (this.history_index >= 0 && this.history_index < this.history.length) {
          document.getElementById(`${this.tid}-input`).value = this.history[this.history_index];
          return this.setTrailingCaret();
        } else if (this.history_index === this.history.length) {
          document.getElementById(`${this.tid}-input`).value = this.current_input;
          return this.setTrailingCaret();
        }
      }
    });
    return setInterval((() => {
      return this.update();
    }), 16);
  }

  validateLine(v) {
    var i, j, ref;
    this.history_index = null;
    if (v.trim().length > 0 && v !== this.history[this.history.length - 1]) {
      this.history.push(v);
      if (this.history.length > 1000) {
        this.history.splice(0, 1);
      }
      this.saveHistory();
    }
    this.echo(`${v}`, true, "input");
    if (this.commands[v.trim()] != null) {
      return this.commands[v.trim()]();
    } else {
      this.runwindow.runCommand(v);
      if (this.runwindow.multiline) {
        document.querySelector(`#${this.tid}-input-gt i`).classList.add("fa-ellipsis-v");
        for (i = j = 0, ref = this.runwindow.nesting * 2 - 1; j <= ref; i = j += 1) {
          document.getElementById(`${this.tid}-input`).value += " ";
        }
        return this.setTrailingCaret();
      } else {
        return document.querySelector(`#${this.tid}-input-gt i`).classList.remove("fa-ellipsis-v");
      }
    }
  }

  setTrailingCaret() {
    return setTimeout((() => {
      var val;
      val = document.getElementById(`${this.tid}-input`).value;
      return document.getElementById(`${this.tid}-input`).setSelectionRange(val.length, val.length);
    }), 0);
  }

  update() {
    var container, div, e, element, j, len, ref, t;
    if (this.buffer.length > 0) {
      if (this.force_scroll) {
        this.scroll = true;
        this.force_scroll = false;
      } else {
        e = document.getElementById(`${this.tid}-view`);
        this.scroll = Math.abs(e.getBoundingClientRect().height + e.scrollTop - e.scrollHeight) < 10;
      }
      div = document.createDocumentFragment();
      container = document.createElement("div");
      div.appendChild(container);
      ref = this.buffer;
      for (j = 0, len = ref.length; j < len; j++) {
        t = ref[j];
        container.appendChild(element = this.echoReal(t.text, t.classname));
      }
      document.getElementById(`${this.tid}-lines`).appendChild(div);
      if (this.scroll) {
        element.scrollIntoView();
      }
      this.length += this.buffer.length;
      return this.buffer = [];
    }
  }

  echo(text, scroll = false, classname) {
    this.buffer.push({
      text: text,
      classname: classname
    });
  }

  echoReal(text, classname) {
    var d, div, i;
    div = document.createElement("div");
    if (classname === "input") {
      d = document.createTextNode(" " + text);
      i = document.createElement("i");
      i.classList.add("fa");
      i.classList.add("fa-angle-right");
      div.appendChild(i);
      div.appendChild(d);
    } else {
      div.innerText = text;
    }
    if (classname != null) {
      div.classList.add(classname);
    }
    this.truncate();
    return div;
  }

  error(text, scroll = false) {
    this.echo(text, scroll, "error");
    return this.error_lines += 1;
  }

  truncate() {
    var c, e;
    e = document.getElementById(`${this.tid}-lines`);
    while (this.length > 10000 && (e.firstChild != null)) {
      c = e.firstChild.children.length;
      e.removeChild(e.firstChild);
      this.length -= c;
    }
  }

  clear() {
    document.getElementById(`${this.tid}-lines`).innerHTML = "";
    this.buffer = [];
    this.length = 0;
    this.error_lines = 0;
    document.querySelector(`#${this.tid}-input-gt i`).classList.remove("fa-ellipsis-v");
    return delete this.runwindow.multiline;
  }

};

this.Project = class Project {
  constructor(app, data) {
    var f, k, len1, ref;
    this.setSourceList = this.setSourceList.bind(this);
    this.setSpriteList = this.setSpriteList.bind(this);
    this.setMapList = this.setMapList.bind(this);
    this.setSoundList = this.setSoundList.bind(this);
    this.setMusicList = this.setMusicList.bind(this);
    this.setAssetList = this.setAssetList.bind(this);
    this.app = app;
    this.id = data.id;
    this.owner = data.owner;
    this.accepted = data.accepted;
    this.slug = data.slug;
    this.code = data.code;
    this.title = data.title;
    this.description = data.description;
    this.tags = data.tags;
    this.public = data.public;
    this.unlisted = data.unlisted;
    this.platforms = data.platforms;
    this.controls = data.controls;
    this.type = data.type;
    this.orientation = data.orientation;
    this.graphics = data.graphics || "M1";
    this.language = data.language || "microscript_v1_i";
    this.libs = data.libs || [];
    this.aspect = data.aspect;
    this.users = data.users;
    this.tabs = data.tabs;
    this.plugins = data.plugins;
    this.libraries = data.libraries;
    this.networking = data.networking;
    this.properties = data.properties || {};
    this.flags = data.flags || {};
    this.file_types = ["source", "sprite", "map", "asset", "sound", "music"];
    ref = this.file_types;
    for (k = 0, len1 = ref.length; k < len1; k++) {
      f = ref[k];
      this[`${f}_list`] = [];
      this[`${f}_table`] = {};
      this[`${f}_folder`] = new ProjectFolder(null, f);
    }
    this.locks = {};
    this.lock_time = {};
    this.friends = {};
    this.url = location.origin + `/${this.owner.nick}/${this.slug}/`;
    this.listeners = [];
    setInterval((() => {
      return this.checkLocks();
    }), 1000);
    this.pending_changes = [];
    this.onbeforeunload = null;
  }

  getFullURL() {
    if (this.public) {
      return this.url;
    } else {
      return location.origin + `/${this.owner.nick}/${this.slug}/${this.code}/`;
    }
  }

  addListener(lis) {
    return this.listeners.push(lis);
  }

  notifyListeners(change) {
    var k, len1, lis, ref;
    ref = this.listeners;
    for (k = 0, len1 = ref.length; k < len1; k++) {
      lis = ref[k];
      lis.projectUpdate(change);
    }
  }

  load() {
    this.updateSourceList();
    this.updateSpriteList();
    this.updateMapList();
    this.updateSoundList();
    this.updateMusicList();
    this.updateAssetList();
    return this.loadDoc();
  }

  loadDoc() {
    this.app.doc_editor.setDoc("");
    return this.app.readProjectFile(this.id, "doc/doc.md", (content) => {
      return this.app.doc_editor.setDoc(content);
    });
  }

  updateFileList(folder, callback) {
    return this.app.client.sendRequest({
      name: "list_project_files",
      project: this.app.project.id,
      folder: folder
    }, (msg) => {
      return this[callback](msg.files);
    });
  }

  updateSourceList() {
    return this.updateFileList("ms", "setSourceList");
  }

  updateSpriteList() {
    return this.updateFileList("sprites", "setSpriteList");
  }

  updateMapList() {
    return this.updateFileList("maps", "setMapList");
  }

  updateSoundList() {
    return this.updateFileList("sounds", "setSoundList");
  }

  updateMusicList() {
    return this.updateFileList("music", "setMusicList");
  }

  updateAssetList() {
    return this.updateFileList("assets", "setAssetList");
  }

  lockFile(file) {
    var lock;
    lock = this.lock_time[file];
    if ((lock != null) && Date.now() < lock) {
      return;
    }
    this.lock_time[file] = Date.now() + 2000;
    console.info(`locking file ${file}`);
    return this.app.client.sendRequest({
      name: "lock_project_file",
      project: this.id,
      file: file
    }, (msg) => {});
  }

  fileLocked(msg) {
    this.locks[msg.file] = {
      user: msg.user,
      time: Date.now() + 10000
    };
    this.friends[msg.user] = Date.now() + 120000;
    return this.notifyListeners("locks");
  }

  isLocked(file) {
    var lock;
    lock = this.locks[file];
    if ((lock != null) && Date.now() < lock.time) {
      return lock;
    } else {
      return false;
    }
  }

  checkLocks() {
    var change, file, lock, ref, ref1, time, user;
    change = false;
    ref = this.locks;
    for (file in ref) {
      lock = ref[file];
      if (Date.now() > lock.time) {
        delete this.locks[file];
        change = true;
      }
    }
    ref1 = this.friends;
    for (user in ref1) {
      time = ref1[user];
      if (Date.now() > time) {
        delete this.friends[user];
        change = true;
      }
    }
    if (change) {
      return this.notifyListeners("locks");
    }
  }

  changeSpriteName(old, name) {
    var changed, i, j, k, l, len1, map, n, ref, ref1, ref2, s;
    old = old.replace(/-/g, "/");
    ref = this.map_list;
    for (k = 0, len1 = ref.length; k < len1; k++) {
      map = ref[k];
      changed = false;
      for (i = l = 0, ref1 = map.width - 1; l <= ref1; i = l += 1) {
        for (j = n = 0, ref2 = map.height - 1; n <= ref2; j = n += 1) {
          s = map.get(i, j);
          if ((s != null) && s.length > 0) {
            s = s.split(":");
            if (s[0] === old) {
              changed = true;
              if (s[1] != null) {
                map.set(i, j, name + ":" + s[1]);
              } else {
                map.set(i, j, name);
              }
            }
          }
        }
      }
      if (changed) {
        this.app.client.sendRequest({
          name: "write_project_file",
          project: this.app.project.id,
          file: `maps/${map.name}.json`,
          content: map.save()
        }, (msg) => {});
      }
    }
  }

  changeMapName(old, name) {
    this.map_table[name] = this.map_table[old];
    return delete this.map_table[old];
  }

  fileUpdated(msg) {
    var name;
    if (msg.file.indexOf("ms/") === 0) {
      name = msg.file.substring("ms/".length, msg.file.indexOf(".ms"));
      if (this.source_table[name] != null) {
        return this.source_table[name].reload();
      } else {
        return this.updateSourceList();
      }
    } else if (msg.file === "doc/doc.md") {
      return this.app.doc_editor.setDoc(msg.content);
    } else if (msg.file.indexOf("sprites/") === 0) {
      name = msg.file.substring("sprites/".length, msg.file.indexOf(".png"));
      if (this.sprite_table[name] != null) {
        if (msg.properties != null) {
          this.sprite_table[name].properties = msg.properties;
          if (msg.properties.fps != null) {
            this.sprite_table[name].fps = msg.properties.fps;
          }
        }
        return this.sprite_table[name].reload(() => {
          if (name === this.app.sprite_editor.selected_sprite) {
            return this.app.sprite_editor.currentSpriteUpdated();
          }
        });
      } else {
        return this.updateSpriteList();
      }
    } else if (msg.file.indexOf("maps/") === 0) {
      name = msg.file.substring("maps/".length, msg.file.indexOf(".json"));
      if (this.map_table[name] != null) {
        return this.map_table[name].loadFile();
      } else {
        return this.updateMapList();
      }
    } else if (msg.file.indexOf("sounds/") === 0) {
      name = msg.file.substring("sounds/".length, msg.file.length).split(".")[0];
      if (this.sound_table[name] == null) {
        return this.updateSoundList();
      }
    } else if (msg.file.indexOf("music/") === 0) {
      name = msg.file.substring("music/".length, msg.file.length).split(".")[0];
      if (this.music_table[name] == null) {
        return this.updateMusicList();
      }
    } else if (msg.file.indexOf("assets/") === 0) {
      name = msg.file.substring("assets/".length, msg.file.length).split(".")[0];
      if (this.asset_table[name] == null) {
        return this.updateAssetList();
      }
    }
  }

  fileDeleted(msg) {
    if (msg.file.indexOf("ms/") === 0) {
      return this.updateSourceList();
    } else if (msg.file.indexOf("sprites/") === 0) {
      return this.updateSpriteList();
    } else if (msg.file.indexOf("maps/") === 0) {
      return this.updateMapList();
    } else if (msg.file.indexOf("sounds/") === 0) {
      return this.updateSoundList();
    } else if (msg.file.indexOf("music/") === 0) {
      return this.updateMusicList();
    }
  }

  optionsUpdated(data) {
    this.slug = data.slug;
    this.title = data.title;
    this.public = data.public;
    this.platforms = data.platforms;
    this.controls = data.controls;
    this.type = data.type;
    this.orientation = data.orientation;
    return this.aspect = data.aspect;
  }

  addSprite(sprite) {
    var s;
    s = new ProjectSprite(this, sprite.file, null, null, sprite.properties, sprite.size);
    this.sprite_table[s.name] = s;
    this.sprite_list.push(s);
    this.sprite_folder.push(s);
    return s;
  }

  getSprite(name) {
    return this.sprite_table[name];
  }

  createSprite(width, height, name = "sprite") {
    var count, filename, sprite;
    if (this.getSprite(name)) {
      count = 2;
      while (true) {
        filename = `${name}${count++}`;
        if (this.getSprite(filename) == null) {
          break;
        }
      }
    } else {
      filename = name;
    }
    sprite = new ProjectSprite(this, filename + ".png", width, height);
    this.sprite_table[sprite.name] = sprite;
    this.sprite_list.push(sprite);
    this.sprite_folder.push(sprite);
    this.notifyListeners("spritelist");
    return sprite;
  }

  addSource(file) {
    var s;
    s = new ProjectSource(this, file.file, file.size);
    this.source_table[s.name] = s;
    this.source_list.push(s);
    this.source_folder.push(s);
    return s;
  }

  getSource(name) {
    return this.source_table[name];
  }

  createSource(basename = "source") {
    var count, filename, source;
    count = 2;
    filename = basename;
    while (this.getSource(filename) != null) {
      filename = `${basename}${count++}`;
    }
    source = new ProjectSource(this, filename + ".ms");
    source.fetched = true;
    this.source_table[source.name] = source;
    this.source_list.push(source);
    this.source_folder.push(source);
    this.notifyListeners("sourcelist");
    return source;
  }

  getFullSource() {
    var k, len1, ref, res, s;
    res = "";
    ref = this.source_list;
    for (k = 0, len1 = ref.length; k < len1; k++) {
      s = ref[k];
      res += s + "\n";
    }
    return res;
  }

  setFileList(list, target_list, target_table, get, add, item_id) {
    var f, folder, i, k, l, len1, len2, li, n, notification, ref, s;
    notification = item_id + "list";
    li = [];
    for (k = 0, len1 = list.length; k < len1; k++) {
      f = list[k];
      li.push(f.file);
    }
    folder = this[item_id + "_folder"];
    folder.removeNoMatch(li);
//@[item_id+"_folder"] = new ProjectFolder(null,item_id)
    for (i = l = ref = target_list.length - 1; l >= 0; i = l += -1) {
      s = target_list[i];
      if (li.indexOf(s.filename) < 0) {
        target_list.splice(i, 1);
        delete target_table[s.name];
      }
    }
    for (n = 0, len2 = list.length; n < len2; n++) {
      s = list[n];
      if (!this[get](s.file.split(".")[0])) {
        this[add](s);
      }
    }
    folder.removeEmptyFolders();
    folder.sort();
    return this.notifyListeners(notification);
  }

  setSourceList(list) {
    return this.setFileList(list, this.source_list, this.source_table, "getSource", "addSource", "source");
  }

  setSpriteList(list) {
    return this.setFileList(list, this.sprite_list, this.sprite_table, "getSprite", "addSprite", "sprite");
  }

  setMapList(list) {
    return this.setFileList(list, this.map_list, this.map_table, "getMap", "addMap", "map");
  }

  setSoundList(list) {
    return this.setFileList(list, this.sound_list, this.sound_table, "getSound", "addSound", "sound");
  }

  setMusicList(list) {
    return this.setFileList(list, this.music_list, this.music_table, "getMusic", "addMusic", "music");
  }

  setAssetList(list) {
    return this.setFileList(list, this.asset_list, this.asset_table, "getAsset", "addAsset", "asset");
  }

  addMap(file) {
    var m;
    m = new ProjectMap(this, file.file, file.size);
    this.map_table[m.name] = m;
    this.map_list.push(m);
    this.map_folder.push(m);
    return m;
  }

  getMap(name) {
    return this.map_table[name];
  }

  addAsset(file) {
    var m;
    m = new ProjectAsset(this, file.file, file.size);
    this.asset_table[m.name] = m;
    this.asset_list.push(m);
    this.asset_folder.push(m);
    return m;
  }

  getAsset(name) {
    return this.asset_table[name];
  }

  createMap(basename = "map") {
    var count, m, name;
    name = basename;
    count = 2;
    while (this.getMap(name)) {
      name = `${basename}${count++}`;
    }
    m = this.addMap({
      file: name + ".json",
      size: 0
    });
    this.notifyListeners("maplist");
    return m;
  }

  createSound(name = "sound", thumbnail, size) {
    var count, filename, sound;
    if (this.getSound(name)) {
      count = 2;
      while (true) {
        filename = `${name}${count++}`;
        if (this.getSound(filename) == null) {
          break;
        }
      }
    } else {
      filename = name;
    }
    sound = new ProjectSound(this, filename + ".wav", size);
    if (thumbnail) {
      sound.thumbnail_url = thumbnail;
    }
    this.sound_table[sound.name] = sound;
    this.sound_list.push(sound);
    this.sound_folder.push(sound);
    this.notifyListeners("soundlist");
    return sound;
  }

  addSound(file) {
    var m;
    m = new ProjectSound(this, file.file, file.size);
    this.sound_table[m.name] = m;
    this.sound_list.push(m);
    this.sound_folder.push(m);
    return m;
  }

  getSound(name) {
    return this.sound_table[name];
  }

  createMusic(name = "music", thumbnail, size) {
    var count, filename, music;
    if (this.getMusic(name)) {
      count = 2;
      while (true) {
        filename = `${name}${count++}`;
        if (this.getMusic(filename) == null) {
          break;
        }
      }
    } else {
      filename = name;
    }
    music = new ProjectMusic(this, filename + ".mp3", size);
    if (thumbnail) {
      music.thumbnail_url = thumbnail;
    }
    this.music_table[music.name] = music;
    this.music_list.push(music);
    this.music_folder.push(music);
    this.notifyListeners("musiclist");
    return music;
  }

  addMusic(file) {
    var m;
    m = new ProjectMusic(this, file.file, file.size);
    this.music_table[m.name] = m;
    this.music_list.push(m);
    this.music_folder.push(m);
    return m;
  }

  getMusic(name) {
    return this.music_table[name];
  }

  createAsset(name = "asset", thumbnail, size, ext) {
    var asset, count, filename;
    if (this.getAsset(name)) {
      count = 2;
      while (true) {
        filename = `${name}${count++}`;
        if (this.getAsset(filename) == null) {
          break;
        }
      }
    } else {
      filename = name;
    }
    asset = new ProjectAsset(this, filename + `.${ext}`, size);
    if (thumbnail) {
      asset.thumbnail_url = thumbnail;
    }
    this.asset_table[asset.name] = asset;
    this.asset_list.push(asset);
    this.asset_folder.push(asset);
    this.notifyListeners("assetlist");
    return asset;
  }

  setTitle(title) {
    this.title = title;
    return this.notifyListeners("title");
  }

  setSlug(slug) {
    this.slug = slug;
    return this.notifyListeners("slug");
  }

  setCode(code) {
    this.code = code;
    return this.notifyListeners("code");
  }

  setType(type1) {
    this.type = type1;
  }

  setOrientation(orientation) {
    this.orientation = orientation;
  }

  //window.dispatchEvent(new Event('resize'))
  setAspect(aspect) {
    this.aspect = aspect;
  }

  //window.dispatchEvent(new Event('resize'))
  setGraphics(graphics) {
    this.graphics = graphics;
  }

  //window.dispatchEvent(new Event('resize'))
  setLanguage(language) {
    this.language = language;
  }

  //window.dispatchEvent(new Event('resize'))
  addPendingChange(item) {
    if (this.pending_changes.indexOf(item) < 0) {
      this.pending_changes.push(item);
    }
    if (this.onbeforeunload == null) {
      this.onbeforeunload = (event) => {
        event.preventDefault();
        event.returnValue = "You have pending unsaved changed.";
        this.savePendingChanges();
        return event.returnValue;
      };
      return window.addEventListener("beforeunload", this.onbeforeunload);
    }
  }

  removePendingChange(item) {
    var index;
    index = this.pending_changes.indexOf(item);
    if (index >= 0) {
      this.pending_changes.splice(index, 1);
    }
    if (this.pending_changes.length === 0) {
      if (this.onbeforeunload != null) {
        window.removeEventListener("beforeunload", this.onbeforeunload);
        return this.onbeforeunload = null;
      }
    }
  }

  savePendingChanges(callback) {
    var save;
    if (this.pending_changes.length > 0) {
      save = this.pending_changes.splice(0, 1)[0];
      return save.forceSave(() => {
        return this.savePendingChanges(callback);
      });
    } else {
      if (callback != null) {
        return callback();
      }
    }
  }

  getSize() {
    var k, l, len1, len2, ref, s, size, t, type;
    size = 0;
    ref = this.file_types;
    for (k = 0, len1 = ref.length; k < len1; k++) {
      type = ref[k];
      t = this[`${type}_list`];
      for (l = 0, len2 = t.length; l < len2; l++) {
        s = t[l];
        size += s.size;
      }
    }
    return size;
  }

  writeFile(name, content, options) {
    var folder, i, k, ref;
    name = name.split("/");
    folder = name[0];
    for (i = k = 0, ref = name.length - 1; (0 <= ref ? k <= ref : k >= ref); i = 0 <= ref ? ++k : --k) {
      name[i] = RegexLib.fixFilename(name[i]);
    }
    name = name.slice(1).join("-");
    switch (folder) {
      case "ms":
        return this.writeSourceFile(name, content);
      case "sprites":
        return this.writeSpriteFile(name, content, options.frames, options.fps);
      case "maps":
        return this.writeMapFile(name, content);
      case "sounds":
        return this.writeSoundFile(name, content);
      case "music":
        return this.writeMusicFile(name, content);
      case "assets":
        return this.writeAssetFile(name, content, options.ext);
    }
  }

  writeSourceFile(name, content) {
    return this.app.client.sendRequest({
      name: "write_project_file",
      project: this.id,
      file: `ms/${name}.ms`,
      content: content
    }, (msg) => {
      return this.updateSourceList();
    });
  }

  writeSoundFile(name, content) {
    var audioContext, base64ToArrayBuffer;
    base64ToArrayBuffer = function(base64) {
      var binary_string, bytes, i, k, len, ref;
      binary_string = window.atob(base64);
      len = binary_string.length;
      bytes = new Uint8Array(len);
      for (i = k = 0, ref = len - 1; k <= ref; i = k += 1) {
        bytes[i] = binary_string.charCodeAt(i);
      }
      return bytes.buffer;
    };
    audioContext = new AudioContext();
    return audioContext.decodeAudioData(base64ToArrayBuffer(content), (decoded) => {
      var thumbnailer;
      console.info(decoded);
      thumbnailer = new SoundThumbnailer(decoded, 96, 64);
      return this.app.client.sendRequest({
        name: "write_project_file",
        project: this.id,
        file: `sounds/${name}.wav`,
        properties: {},
        content: content,
        thumbnail: thumbnailer.canvas.toDataURL().split(",")[1]
      }, (msg) => {
        console.info(msg);
        return this.updateSoundList();
      });
    });
  }

  writeMusicFile(name, content) {
    var audioContext, base64ToArrayBuffer;
    base64ToArrayBuffer = function(base64) {
      var binary_string, bytes, i, k, len, ref;
      binary_string = window.atob(base64);
      len = binary_string.length;
      bytes = new Uint8Array(len);
      for (i = k = 0, ref = len - 1; k <= ref; i = k += 1) {
        bytes[i] = binary_string.charCodeAt(i);
      }
      return bytes.buffer;
    };
    audioContext = new AudioContext();
    return audioContext.decodeAudioData(base64ToArrayBuffer(content), (decoded) => {
      var thumbnailer;
      console.info(decoded);
      thumbnailer = new SoundThumbnailer(decoded, 192, 64, "hsl(200,80%,60%)");
      return this.app.client.sendRequest({
        name: "write_project_file",
        project: this.id,
        file: `music/${name}.mp3`,
        properties: {},
        content: content,
        thumbnail: thumbnailer.canvas.toDataURL().split(",")[1]
      }, (msg) => {
        console.info(msg);
        return this.updateMusicList();
      });
    });
  }

  writeSpriteFile(name, content, frames, fps) {
    return this.app.client.sendRequest({
      name: "write_project_file",
      project: this.id,
      file: `sprites/${name}.png`,
      properties: {
        frames: frames,
        fps: fps
      },
      content: content
    }, (msg) => {
      return this.fileUpdated({
        file: `sprites/${name}.png`,
        properties: {
          frames: frames,
          fps: fps
        }
      });
    });
  }

  // @updateSpriteList()
  writeMapFile(name, content) {
    return this.app.client.sendRequest({
      name: "write_project_file",
      project: this.id,
      file: `maps/${name}.json`,
      content: content
    }, (msg) => {
      this.fileUpdated({
        file: `maps/${name}.json`
      });
      return this.updateMapList();
    });
  }

  writeAssetFile(name, content, ext) {
    var send, thumbnail;
    if (ext === "json") {
      content = JSON.stringify(content);
    }
    thumbnail = void 0;
    if (ext === "txt" || ext === "csv" || ext === "json" || ext === "obj") {
      thumbnail = this.app.assets_manager.text_viewer.createThumbnail(content, ext);
      thumbnail = thumbnail.toDataURL().split(",")[1];
    }
    if (ext === "obj") {
      content = btoa(content);
    }
    send = () => {
      return this.app.client.sendRequest({
        name: "write_project_file",
        project: this.id,
        file: `assets/${name}.${ext}`,
        content: content,
        thumbnail: thumbnail
      }, (msg) => {
        return this.updateAssetList();
      });
    };
    if (ext === "png" || ext === "jpg") {
      this.app.assets_manager.image_viewer.createThumbnail(content, (canvas) => {
        thumbnail = canvas.toDataURL().split(",")[1];
        content = content.split(",")[1];
        return send();
      });
      return;
    }
    return send();
  }

};

this.ProjectFolder = class ProjectFolder {
  constructor(parent, name1) {
    this.parent = parent;
    this.name = name1;
    this.subfolders = [];
    this.files = [];
    this.open = false;
  }

  push(item, path = item.name) {
    var f, fold, folders;
    folders = path.split("-");
    if (folders.length > 1) {
      f = folders.splice(0, 1)[0];
      fold = this.getSubFolder(f);
      if (!fold) {
        fold = this.createSubFolder(f);
      }
      fold.push(item, folders.join("-"));
    } else {
      this.files.push(item);
      item.parent = this;
    }
    return item;
  }

  // add:(file,path)->
  //   if not path?
  //     path = file.name.split["-"]

  //   if file instanceof ProjectFolder
  //     @subfolders.push file
  //   else
  //     @files.push file
  getSubFolder(name) {
    var f, j, len, ref;
    ref = this.subfolders;
    for (j = 0, len = ref.length; j < len; j++) {
      f = ref[j];
      if (name === f.name) {
        return f;
      }
    }
    return null;
  }

  isAncestorOf(f) {
    if (this.subfolders.indexOf(f) >= 0) {
      return true;
    }
    if (f.parent != null) {
      return this.isAncestorOf(f.parent);
    } else {
      return false;
    }
  }

  getAllFiles() {
    var f, j, len, list, ref;
    list = [];
    list = list.concat(this.files);
    ref = this.subfolders;
    for (j = 0, len = ref.length; j < len; j++) {
      f = ref[j];
      list = list.concat(f.getAllFiles());
    }
    return list;
  }

  createSubFolder(name) {
    var f;
    f = new ProjectFolder(this, name);
    this.subfolders.push(f);
    return f;
  }

  containsFiles() {
    var f, j, len, ref;
    if (this.files.length > 0) {
      return true;
    } else {
      ref = this.subfolders;
      for (j = 0, len = ref.length; j < len; j++) {
        f = ref[j];
        if (f.containsFiles()) {
          return true;
        }
      }
    }
    return false;
  }

  delete() {
    if (this.parent != null) {
      this.parent.removeFolder(this);
    }
    if ((this.element != null) && (this.element.parentNode != null)) {
      return this.element.parentNode.removeChild(this.element);
    }
  }

  addFolder(f) {
    if (f.parent != null) {
      f.parent.removeFolder(f);
    }
    this.subfolders.push(f);
    return f.parent = this;
  }

  removeFolder(f) {
    var index;
    index = this.subfolders.indexOf(f);
    if (index >= 0) {
      return this.subfolders.splice(index, 1);
    }
  }

  createEmptyFolder() {
    var count, f, name;
    count = 1;
    name = "folder";
    while (this.getSubFolder(name) != null) {
      count += 1;
      name = `folder${count}`;
    }
    f = new ProjectFolder(this, name);
    this.subfolders.push(f);
    return f;
  }

  getFullDashPath() {
    if ((this.parent != null) && (this.parent.parent != null)) {
      return this.parent.getFullDashPath() + "-" + this.name;
    } else {
      return this.name;
    }
  }

  removeNoMatch(list) {
    var f, i, j, k, len, ref, ref1;
    ref = this.subfolders;
    for (j = 0, len = ref.length; j < len; j++) {
      f = ref[j];
      f.removeNoMatch(list);
    }
    for (i = k = ref1 = this.files.length - 1; k >= 0; i = k += -1) {
      f = this.files[i];
      if (list.indexOf(f.filename) < 0) {
        this.files.splice(i, 1);
      }
    }
  }

  removeEmptyFolders() {
    var f, i, j, ref;
    for (i = j = ref = this.subfolders.length - 1; j >= 0; i = j += -1) {
      f = this.subfolders[i];
      f.removeEmptyFolders();
      if (f.subfolders.length === 0 && f.files.length === 0 && !f.protected) {
        this.subfolders.splice(i, 1);
      }
    }
  }

  sort() {
    var f, j, len, ref;
    ref = this.subfolders;
    for (j = 0, len = ref.length; j < len; j++) {
      f = ref[j];
      f.sort();
    }
    this.subfolders.sort(function(a, b) {
      if (a.name < b.name) {
        return -1;
      } else {
        return 1;
      }
    });
    return this.files.sort(function(a, b) {
      if (a.shortname < b.shortname) {
        return -1;
      } else {
        return 1;
      }
    });
  }

  setElement(element) {
    this.element = element;
    return this.setOpen(this.open);
  }

  setOpen(open) {
    this.open = open;
    if (this.element != null) {
      if (this.open) {
        return this.element.classList.add("open");
      } else {
        return this.element.classList.remove("open");
      }
    }
  }

  find() {}

  remove() {}

};

this.ProjectSource = (function() {
  function ProjectSource(project, file, size) {
    var s;
    this.project = project;
    this.file = file;
    this.size = size != null ? size : 0;
    this.name = this.file.split(".")[0];
    this.ext = this.file.split(".")[1];
    this.filename = this.file;
    this.file = "ms/" + this.file;
    s = this.name.split("-");
    this.shortname = s[s.length - 1];
    this.path_prefix = s.length > 1 ? s.splice(0, s.length - 1).join("-") + "-" : "";
    this.content = "";
    this.fetched = false;
    this.reload();
  }

  ProjectSource.prototype.reload = function(callback) {
    return this.project.app.client.sendRequest({
      name: "read_project_file",
      project: this.project.id,
      file: this.file
    }, (function(_this) {
      return function(msg) {
        _this.content = msg.content;
        _this.fetched = true;
        _this.loaded();
        if (callback != null) {
          return callback();
        }
      };
    })(this));
  };

  ProjectSource.prototype.loaded = function() {
    return this.project.notifyListeners(this);
  };

  ProjectSource.prototype.rename = function(name) {
    var s;
    delete this.project.source_table[this.name];
    this.name = name;
    this.project.source_table[this.name] = this;
    this.filename = this.name + "." + this.ext;
    this.file = "ms/" + this.filename;
    s = this.name.split("-");
    this.shortname = s[s.length - 1];
    return this.path_prefix = s.length > 1 ? s.splice(0, s.length - 1).join("-") + "-" : "";
  };

  return ProjectSource;

})();

var bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

this.ProjectSprite = (function(superClass) {
  extend(ProjectSprite, superClass);

  function ProjectSprite(project, name, width, height, properties, size1) {
    var s;
    this.project = project;
    this.size = size1 != null ? size1 : 0;
    this.updateThumbnail = bind(this.updateThumbnail, this);
    this.properties = properties;
    if ((width != null) && (height != null)) {
      ProjectSprite.__super__.constructor.call(this, width, height, properties);
      this.file = name;
      this.url = this.project.getFullURL() + "sprites/" + this.file;
    } else {
      this.file = name;
      this.url = this.project.getFullURL() + "sprites/" + this.file;
      ProjectSprite.__super__.constructor.call(this, this.url, void 0, properties);
    }
    this.name = this.file.split(".")[0];
    this.ext = this.file.split(".")[1];
    this.filename = this.file;
    this.file = "sprites/" + this.file;
    s = this.name.split("-");
    this.shortname = s[s.length - 1];
    this.path_prefix = s.length > 1 ? s.splice(0, s.length - 1).join("-") + "-" : "";
    this.images = [];
    this.load_listeners = [];
  }

  ProjectSprite.prototype.addLoadListener = function(listener) {
    if (this.ready) {
      return listener();
    } else {
      return this.load_listeners.push(listener);
    }
  };

  ProjectSprite.prototype.addImage = function(img, size) {
    if (size == null) {
      throw "Size must be defined";
    }
    return this.images.push({
      image: img,
      size: size
    });
  };

  ProjectSprite.prototype.updated = function(url) {
    var i, j, len, ref;
    if (url == null) {
      url = this.project.getFullURL() + this.file + ("?v=" + (Date.now()));
    }
    ref = this.images;
    for (j = 0, len = ref.length; j < len; j++) {
      i = ref[j];
      i.image.src = url;
    }
    if (this.updateThumbnail != null) {
      this.updateThumbnail();
    }
  };

  ProjectSprite.prototype.reload = function(callback) {
    var img, url;
    url = this.project.getFullURL() + this.file + ("?v=" + (Date.now()));
    img = new Image;
    img.crossOrigin = "Anonymous";
    img.src = url;
    return img.onload = (function(_this) {
      return function() {
        _this.load(img, _this.properties);
        _this.updated(url);
        if (callback != null) {
          return callback();
        }
      };
    })(this);
  };

  ProjectSprite.prototype.loaded = function() {
    var j, k, l, len, len1, m, ref, ref1;
    ref = this.project.map_list;
    for (j = 0, len = ref.length; j < len; j++) {
      m = ref[j];
      m.update();
      m.updateCanvases();
    }
    ref1 = this.load_listeners;
    for (k = 0, len1 = ref1.length; k < len1; k++) {
      l = ref1[k];
      l();
    }
    this.project.notifyListeners(this);
  };

  ProjectSprite.prototype.rename = function(name) {
    var s;
    this.project.changeSpriteName(this.name, name);
    delete this.project.sprite_table[this.name];
    this.name = name;
    this.project.sprite_table[this.name] = this;
    this.filename = this.name + "." + this.ext;
    this.file = "sprites/" + this.filename;
    this.url = this.project.getFullURL() + this.file;
    s = this.name.split("-");
    this.shortname = s[s.length - 1];
    return this.path_prefix = s.length > 1 ? s.splice(0, s.length - 1).join("-") + "-" : "";
  };

  ProjectSprite.prototype.updateThumbnail = function() {
    var canvas, context, frame, h, j, len, r, ref, results, w;
    if (!this.thumbnails) {
      return;
    }
    ref = this.thumbnails;
    results = [];
    for (j = 0, len = ref.length; j < len; j++) {
      canvas = ref[j];
      context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
      frame = this.frames[0].getCanvas();
      r = Math.min(64 / frame.width, 64 / frame.height);
      context.imageSmoothingEnabled = false;
      w = r * frame.width;
      h = r * frame.height;
      results.push(context.drawImage(frame, 32 - w / 2, 32 - h / 2, w, h));
    }
    return results;
  };

  ProjectSprite.prototype.getThumbnailElement = function() {
    var canvas, mouseover, update;
    canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    if (this.thumbnails == null) {
      this.thumbnails = [];
      this.addLoadListener((function(_this) {
        return function() {
          return _this.updateThumbnail();
        };
      })(this));
    }
    this.thumbnails.push(canvas);
    mouseover = false;
    update = (function(_this) {
      return function() {
        var context, dt, frame, h, r, t, w;
        if (mouseover && _this.frames.length > 1) {
          requestAnimationFrame(function() {
            return update();
          });
        }
        dt = 1000 / _this.fps;
        t = Date.now();
        frame = mouseover ? Math.floor(t / dt) % _this.frames.length : 0;
        context = canvas.getContext("2d");
        context.imageSmoothingEnabled = false;
        context.clearRect(0, 0, 64, 64);
        frame = _this.frames[frame].getCanvas();
        r = Math.min(64 / frame.width, 64 / frame.height);
        w = r * frame.width;
        h = r * frame.height;
        return context.drawImage(frame, 32 - w / 2, 32 - h / 2, w, h);
      };
    })(this);
    canvas.addEventListener("mouseenter", (function(_this) {
      return function() {
        mouseover = true;
        return update();
      };
    })(this));
    canvas.addEventListener("mouseout", (function(_this) {
      return function() {
        return mouseover = false;
      };
    })(this));
    canvas.updateSprite = update;
    if (this.ready) {
      update();
    }
    return canvas;
  };

  ProjectSprite.prototype.canBeRenamed = function() {
    return this.name !== "icon";
  };

  return ProjectSprite;

})(Sprite);

var extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

this.ProjectMap = (function(superClass) {
  extend(ProjectMap, superClass);

  function ProjectMap(project, file, size) {
    var s;
    this.project = project;
    this.file = file;
    this.size = size != null ? size : 0;
    ProjectMap.__super__.constructor.call(this, 16, 10, 16, 16, this.project.sprite_table);
    this.url = this.project.getFullURL() + this.file;
    this.canvases = [];
    this.name = this.file.split(".")[0];
    this.ext = this.file.split(".")[1];
    this.filename = this.file;
    this.file = "maps/" + this.file;
    s = this.name.split("-");
    this.shortname = s[s.length - 1];
    this.path_prefix = s.length > 1 ? s.splice(0, s.length - 1).join("-") + "-" : "";
    this.loadFile();
  }

  ProjectMap.prototype.addCanvas = function(canvas) {
    this.canvases.push(canvas);
    return this.updateCanvas(canvas);
  };

  ProjectMap.prototype.updateCanvases = function() {
    var c, i, len, ref;
    ref = this.canvases;
    for (i = 0, len = ref.length; i < len; i++) {
      c = ref[i];
      this.updateCanvas(c);
    }
  };

  ProjectMap.prototype.updateCanvas = function(c) {
    var context, h, r, r1, r2, w;
    r1 = Math.max(128 / this.width, 96 / this.height);
    r2 = Math.min(128 / this.width, 96 / this.height);
    r = (r1 + r2) / 2;
    w = r * this.width;
    h = r * this.height;
    context = c.getContext("2d");
    context.fillStyle = "#666";
    context.fillRect(0, 0, c.width, c.height);
    context.imageSmoothingEnabled = false;
    return this.draw(context, c.width / 2 - w / 2, c.height / 2 - h / 2, w, h);
  };

  ProjectMap.prototype.loadFile = function() {
    return this.project.app.client.sendRequest({
      name: "read_project_file",
      project: this.project.id,
      file: this.file
    }, (function(_this) {
      return function(msg) {
        _this.load(msg.content, _this.project.sprite_table);
        _this.update();
        _this.updateCanvases();
        if (_this.project.app.map_editor.selected_map === _this.name) {
          return _this.project.app.map_editor.currentMapUpdated();
        }
      };
    })(this));
  };

  ProjectMap.prototype.getThumbnailElement = function() {
    var context;
    if (this.thumbnail == null) {
      this.thumbnail = document.createElement("canvas");
      this.thumbnail.width = 128;
      this.thumbnail.height = 96;
      context = this.thumbnail.getContext("2d");
      context.fillStyle = "#000";
      context.fillRect(0, 0, 128, 96);
      this.canvases.push(this.thumbnail);
      this.update();
      this.updateCanvases();
    }
    return this.thumbnail;
  };

  ProjectMap.prototype.rename = function(name) {
    var s;
    delete this.project.map_table[this.name];
    this.name = name;
    this.project.map_table[this.name] = this;
    this.filename = this.name + "." + this.ext;
    this.file = "maps/" + this.filename;
    this.url = this.project.getFullURL() + this.file;
    s = this.name.split("-");
    this.shortname = s[s.length - 1];
    return this.path_prefix = s.length > 1 ? s.splice(0, s.length - 1).join("-") + "-" : "";
  };

  return ProjectMap;

})(MicroMap);

this.ProjectAsset = (function() {
  function ProjectAsset(project, file, size) {
    var s;
    this.project = project;
    this.file = file;
    this.size = size != null ? size : 0;
    this.name = this.file.split(".")[0];
    this.ext = this.file.split(".")[1];
    this.filename = this.file;
    this.file = "assets/" + this.file;
    s = this.name.split("-");
    this.shortname = s[s.length - 1];
    this.path_prefix = s.length > 1 ? s.splice(0, s.length - 1).join("-") + "-" : "";
  }

  ProjectAsset.prototype.getURL = function() {
    if (this.local_url != null) {
      return this.local_url;
    }
    return this.project.getFullURL() + this.file;
  };

  ProjectAsset.prototype.getThumbnailURL = function() {
    var f;
    if (this.thumbnail_url != null) {
      return this.thumbnail_url;
    }
    f = this.file.split(".")[0] + ".png";
    f = f.replace("assets/", "assets_th/");
    return this.project.getFullURL() + f;
  };

  ProjectAsset.prototype.loaded = function() {
    return this.project.notifyListeners(this);
  };

  ProjectAsset.prototype.rename = function(name) {
    var s;
    delete this.project.asset_table[this.name];
    this.name = name;
    this.project.asset_table[this.name] = this;
    this.filename = this.name + "." + this.ext;
    this.file = "assets/" + this.filename;
    s = this.name.split("-");
    this.shortname = s[s.length - 1];
    return this.path_prefix = s.length > 1 ? s.splice(0, s.length - 1).join("-") + "-" : "";
  };

  return ProjectAsset;

})();

this.ProjectSound = (function() {
  function ProjectSound(project, file, size) {
    var s;
    this.project = project;
    this.file = file;
    this.size = size != null ? size : 0;
    this.name = this.file.split(".")[0];
    this.ext = this.file.split(".")[1];
    this.filename = this.file;
    this.file = "sounds/" + this.file;
    s = this.name.split("-");
    this.shortname = s[s.length - 1];
    this.path_prefix = s.length > 1 ? s.splice(0, s.length - 1).join("-") + "-" : "";
  }

  ProjectSound.prototype.getURL = function() {
    if (this.local_url != null) {
      return this.local_url;
    }
    return this.project.getFullURL() + this.file;
  };

  ProjectSound.prototype.getThumbnailURL = function() {
    var f;
    if (this.thumbnail_url != null) {
      return this.thumbnail_url;
    }
    f = this.file.split(".")[0] + ".png";
    f = f.replace("sounds/", "sounds_th/");
    return this.project.getFullURL() + f;
  };

  ProjectSound.prototype.loaded = function() {
    return this.project.notifyListeners(this);
  };

  ProjectSound.prototype.play = function() {
    var audio, funk;
    audio = new Audio(this.getURL());
    audio.play();
    funk = function() {
      audio.pause();
      return document.body.removeEventListener("mousedown", funk);
    };
    return document.body.addEventListener("mousedown", funk);
  };

  ProjectSound.prototype.rename = function(name) {
    var s;
    delete this.project.sound_table[this.name];
    this.name = name;
    this.project.sound_table[this.name] = this;
    this.filename = this.name + "." + this.ext;
    this.file = "sounds/" + this.filename;
    s = this.name.split("-");
    this.shortname = s[s.length - 1];
    return this.path_prefix = s.length > 1 ? s.splice(0, s.length - 1).join("-") + "-" : "";
  };

  return ProjectSound;

})();

this.ProjectMusic = (function() {
  function ProjectMusic(project, file, size) {
    var s;
    this.project = project;
    this.file = file;
    this.size = size != null ? size : 0;
    this.name = this.file.split(".")[0];
    this.ext = this.file.split(".")[1];
    this.filename = this.file;
    this.file = "music/" + this.file;
    s = this.name.split("-");
    this.shortname = s[s.length - 1];
    this.path_prefix = s.length > 1 ? s.splice(0, s.length - 1).join("-") + "-" : "";
  }

  ProjectMusic.prototype.getURL = function() {
    if (this.local_url != null) {
      return this.local_url;
    }
    return this.project.getFullURL() + this.file;
  };

  ProjectMusic.prototype.getThumbnailURL = function() {
    var f;
    if (this.thumbnail_url != null) {
      return this.thumbnail_url;
    }
    f = this.file.split(".")[0] + ".png";
    f = f.replace("music/", "music_th/");
    return this.project.getFullURL() + f;
  };

  ProjectMusic.prototype.loaded = function() {
    return this.project.notifyListeners(this);
  };

  ProjectMusic.prototype.play = function() {
    var funk;
    if (this.audio == null) {
      this.audio = new Audio(this.getURL());
      this.audio.loop = true;
    }
    funk = (function(_this) {
      return function() {
        document.body.removeEventListener("mousedown", funk);
        return _this.audio.pause();
      };
    })(this);
    document.body.addEventListener("mousedown", funk);
    return this.audio.play();
  };

  ProjectMusic.prototype.rename = function(name1) {
    var s;
    this.name = name1;
    delete this.project.music_table[this.name];
    this.name = name;
    this.project.music_table[this.name] = this;
    this.filename = this.name + "." + this.ext;
    this.file = "music/" + this.filename;
    s = this.name.split("-");
    this.shortname = s[s.length - 1];
    return this.path_prefix = s.length > 1 ? s.splice(0, s.length - 1).join("-") + "-" : "";
  };

  return ProjectMusic;

})();

this.FloatingWindow = class FloatingWindow {
  constructor(app, elementid, listener, options = {}) {
    this.app = app;
    this.elementid = elementid;
    this.listener = listener;
    this.options = options;
    this.window = document.getElementById(this.elementid);
    document.querySelector(`#${this.elementid}`).addEventListener("mousedown", (event) => {
      return this.moveToFront();
    });
    document.querySelector(`#${this.elementid} .titlebar`).addEventListener("mousedown", (event) => {
      return this.startMove(event);
    });
    if (!this.options.fixed_size) {
      document.querySelector(`#${this.elementid} .navigation .resize`).addEventListener("mousedown", (event) => {
        return this.startResize(event);
      });
    }
    document.addEventListener("mousemove", (event) => {
      return this.mouseMove(event);
    });
    document.addEventListener("mouseup", (event) => {
      return this.mouseUp(event);
    });
    window.addEventListener("resize", () => {
      var b;
      b = this.window.getBoundingClientRect();
      return this.setPosition(b.x - this.getParentX(), b.y - this.getParentY());
    });
    document.querySelector(`#${this.elementid} .titlebar .minify`).addEventListener("click", () => {
      return this.close();
    });
    this.max_ratio = .75;
  }

  moveToFront() {
    var e, i, len, list;
    list = document.getElementsByClassName("floating-window");
    for (i = 0, len = list.length; i < len; i++) {
      e = list[i];
      if (e.id === this.elementid) {
        e.style["z-index"] = 11;
      } else {
        e.style["z-index"] = 10;
      }
    }
  }

  close() {
    this.shown = false;
    document.getElementById(`${this.elementid}`).style.display = "none";
    if ((this.listener != null) && (this.listener.floatingWindowClosed != null)) {
      return this.listener.floatingWindowClosed();
    }
  }

  show() {
    this.shown = true;
    document.getElementById(`${this.elementid}`).style.display = "block";
    return this.moveToFront();
  }

  startMove(event) {
    var e, i, len, list;
    this.moving = true;
    this.drag_start_x = event.clientX;
    this.drag_start_y = event.clientY;
    this.drag_pos_x = this.window.getBoundingClientRect().x - this.getParentX();
    this.drag_pos_y = this.window.getBoundingClientRect().y - this.getParentY();
    list = document.querySelectorAll("iframe");
    for (i = 0, len = list.length; i < len; i++) {
      e = list[i];
      e.classList.add("ignoreMouseEvents");
    }
  }

  startResize(event) {
    var e, i, len, list;
    this.resizing = true;
    this.drag_start_x = event.clientX;
    this.drag_start_y = event.clientY;
    this.drag_size_w = this.window.getBoundingClientRect().width;
    this.drag_size_h = this.window.getBoundingClientRect().height;
    list = document.querySelectorAll("iframe");
    for (i = 0, len = list.length; i < len; i++) {
      e = list[i];
      e.classList.add("ignoreMouseEvents");
    }
  }

  getParentX() {
    if (this.window.parentNode != null) {
      return this.window.parentNode.getBoundingClientRect().x;
    } else {
      return 0;
    }
  }

  getParentY() {
    if (this.window.parentNode != null) {
      return this.window.parentNode.getBoundingClientRect().y;
    } else {
      return 0;
    }
  }

  getParentWidth() {
    if ((this.window.parentNode != null) && this.window.parentNode !== document.body) {
      return this.window.parentNode.clientWidth;
    } else {
      return window.innerWidth;
    }
  }

  getParentHeight() {
    if ((this.window.parentNode != null) && this.window.parentNode !== document.body) {
      return this.window.parentNode.clientHeight;
    } else {
      return window.innerHeight;
    }
  }

  mouseMove(event) {
    var b, dx, dy, h, w;
    if (this.moving) {
      dx = event.clientX - this.drag_start_x;
      dy = event.clientY - this.drag_start_y;
      this.setPosition(this.drag_pos_x + dx, this.drag_pos_y + dy);
    }
    if (this.resizing) {
      dx = event.clientX - this.drag_start_x;
      dy = event.clientY - this.drag_start_y;
      w = Math.floor(Math.max(200, Math.min(this.getParentWidth() * this.max_ratio, this.drag_size_w + dx)));
      h = Math.floor(Math.max(200, Math.min(this.getParentHeight() * this.max_ratio, this.drag_size_h + dy)));
      if (!this.options.fixed_size) {
        this.window.style.width = `${w}px`;
        this.window.style.height = `${h}px`;
      }
      b = this.window.getBoundingClientRect();
      if (w > this.getParentWidth() - b.x || h > this.getParentHeight() - b.y) {
        this.setPosition(Math.min(b.x - this.getParentX(), this.getParentWidth() - w - 4), Math.min(b.y - this.getParentY(), this.getParentHeight() - h - 4));
      }
      if ((this.listener != null) && (this.listener.floatingWindowResized != null)) {
        return this.listener.floatingWindowResized();
      }
    }
  }

  mouseUp(event) {
    var e, i, len, list;
    this.moving = false;
    this.resizing = false;
    list = document.querySelectorAll("iframe");
    for (i = 0, len = list.length; i < len; i++) {
      e = list[i];
      e.classList.remove("ignoreMouseEvents");
    }
  }

  setPosition(x, y) {
    var b;
    b = this.window.getBoundingClientRect();
    x = Math.max(4 - b.width / 2, Math.min(this.getParentWidth() - b.width / 2 - 4, x));
    y = Math.max(4, Math.min(this.getParentHeight() - b.height / 2 - 4, y));
    this.window.style.top = y + "px";
    return this.window.style.left = x + "px";
  }

  resize(x, y, w, h) {
    if (!this.options.fixed_size) {
      this.window.style.width = `${w}px`;
      this.window.style.height = `${h}px`;
    }
    return this.setPosition(x, y);
  }

};

var AppUI;

AppUI = class AppUI {
  constructor(app1) {
    var advanced, j, k, len, len1, ref, ref1, s;
    this.app = app1;
    this.sections = ["code", "sprites", "maps", "assets", "sounds", "music", "doc", "sync", "options", "publish", "tabs"];
    this.menuoptions = ["home", "explore", "projects", "help", "tutorials", "about", "usersettings"];
    ref = this.sections;
    for (j = 0, len = ref.length; j < len; j++) {
      s = ref[j];
      ((s) => {
        if (document.getElementById(`menuitem-${s}`) != null) {
          return document.getElementById(`menuitem-${s}`).addEventListener("click", (event) => {
            return this.setSection(s, true);
          });
        }
      })(s);
    }
    this.warning_messages = [];
    document.addEventListener("keydown", (e) => {
      if ((window.navigator.platform.match("Mac") ? e.metaKey : e.ctrlKey) && e.keyCode === 83) {
        e.preventDefault();
        switch (this.current_section) {
          case "code":
            return this.app.editor.checkSave(true);
          case "sprites":
            return this.app.sprite_editor.checkSave(true);
          case "maps":
            return this.app.map_editor.checkSave(true);
          case "doc":
            return this.app.doc_editor.checkSave(true);
          case "assets":
            return this.app.assets_manager.text_viewer.checkSave(true);
        }
      }
    });
    ref1 = this.menuoptions;
    for (k = 0, len1 = ref1.length; k < len1; k++) {
      s = ref1[k];
      ((s) => {
        var e;
        e = document.getElementById(`menu-${s}`);
        if (e != null) {
          return e.addEventListener("click", (event) => {
            if (window.ms_standalone && s === "explore") {
              return window.open("https://microstudio.dev/explore/", "_blank");
            } else if (window.ms_standalone && s === "home") {
              return window.open("https://microstudio.dev", "_blank");
            } else {
              return this.setMainSection(s, true);
            }
          });
        }
      })(s);
    }
    this.setAction("logo", () => {
      if (window.ms_standalone) {
        return window.open("https://microstudio.dev", "_blank");
      } else {
        return this.setMainSection("home", true);
      }
    });
    if (window.ms_standalone) {
      document.getElementById("menu-community").parentNode.href = "https://microstudio.dev/community/";
      document.getElementById("projectoptions-users-content").style.display = "none";
      document.getElementById("publish-box-online").style.display = "none";
      document.getElementById("usersetting-block-nickname").style.display = "none";
      document.getElementById("usersetting-block-email").style.display = "none";
      document.getElementById("usersetting-block-newsletter").style.display = "none";
      document.getElementById("usersetting-block-account-type").style.display = "none";
      document.body.classList.add("standalone");
    }
    //@setSection("options")
    this.createLoginFunctions();
    advanced = document.getElementById("advanced-create-project-options-button");
    this.setAction("create-project-button", () => {
      this.show("create-project-overlay");
      this.focus("create-project-title");
      document.getElementById("createprojectoption-type").value = "app";
      document.getElementById("createprojectoption-language").value = window.ms_default_project_language || "microscript_v2";
      document.getElementById("createprojectoption-graphics").value = "M1";
      document.getElementById("createprojectoption-networking").checked = false;
      document.getElementById("create-project-option-lib-matterjs").checked = false;
      document.getElementById("create-project-option-lib-cannonjs").checked = false;
      return this.hideAdvanced();
    });
    this.hideAdvanced = () => {
      advanced.classList.remove("open");
      document.getElementById("advanced-create-project-options").style.display = "none";
      return advanced.childNodes[1].innerText = this.app.translator.get("Advanced");
    };
    advanced.addEventListener("click", () => {
      if (advanced.classList.contains("open")) {
        return this.hideAdvanced();
      } else {
        advanced.classList.add("open");
        document.getElementById("advanced-create-project-options").style.display = "block";
        return advanced.childNodes[1].innerText = this.app.translator.get("Hide advanced options");
      }
    });
    this.setAction("import-project-button", () => {
      var input;
      input = document.createElement("input");
      input.type = "file";
      input.accept = "application/zip";
      input.addEventListener("change", (event) => {
        var f, files;
        files = event.target.files;
        if (files.length >= 1) {
          f = files[0];
          return this.app.importProject(f);
        }
      });
      return input.click();
    });
    this.setAction("home-action-explore", () => {
      return this.setMainSection("explore");
    });
    this.setAction("home-action-create", () => {
      return this.setMainSection("projects");
    });
    document.getElementById("create-project-overlay").addEventListener("mousedown", (event) => {
      var b;
      if (event.target !== document.getElementById("create-project-overlay")) {
        return true;
      }
      b = document.getElementById("create-project-window").getBoundingClientRect();
      if (event.clientX < b.x || event.clientX > b.x + b.width || event.clientY < b.y || event.clientY > b.y + b.height) {
        this.hide("create-project-overlay");
      }
      return true;
    });
    this.setAction("create-project-submit", () => {
      var libs, slug, title;
      title = this.get("create-project-title").value;
      slug = RegexLib.slugify(title);
      if (title.length > 0 && slug.length > 0) {
        libs = [];
        if (document.getElementById("create-project-option-lib-matterjs").checked) {
          libs.push("matterjs");
        }
        if (document.getElementById("create-project-option-lib-cannonjs").checked) {
          libs.push("cannonjs");
        }
        this.app.createProject(title, slug, {
          type: document.getElementById("createprojectoption-type").value,
          language: document.getElementById("createprojectoption-language").value,
          graphics: document.getElementById("createprojectoption-graphics").value,
          networking: document.getElementById("createprojectoption-networking").checked,
          libs: libs
        });
        this.hide("create-project-overlay");
        return this.get("create-project-title").value = "";
      }
    });
    this.doc_splitbar = new SplitBar("doc-section", "horizontal");
    this.doc_splitbar.auto = 1;
    this.code_splitbar = new SplitBar("code-section", "horizontal");
    this.code_splitbar.auto = 1;
    this.runtime_splitbar = new SplitBar("runtime-container", "vertical");
    this.runtime_splitbar.auto = 1.5;
    this.runtime_splitbar.initPosition(67);
    this.server_splitbar = new SplitBar("runtime-terminal", "horizontal");
    this.server_splitbar.initPosition(50);
    this.server_splitbar.closed1 = true;
    this.debug_splitbar = new SplitBar("terminal-debug-container", "horizontal");
    this.debug_splitbar.closed2 = true;
    this.debug_splitbar.splitbar_size = 12;
    this.setAction("backtoprojects", () => {
      if (this.app.project != null) {
        return this.app.project.savePendingChanges(() => {
          return this.backToProjectList(true);
        });
      } else {
        return this.backToProjectList(true);
      }
    });
    this.get("create_nick").addEventListener("input", () => {
      var value;
      value = this.get("create_nick").value;
      if (value !== RegexLib.fixNick(value)) {
        return this.get("create_nick").value = RegexLib.fixNick(value);
      }
    });
    this.startSaveStatus();
    this.last_activity = Date.now();
    document.addEventListener("mousemove", () => {
      return this.last_activity = Date.now();
    });
    document.addEventListener("keydown", () => {
      return this.last_activity = Date.now();
    });
    document.querySelector("#projects-search input").addEventListener("input", () => {
      var l, len2, len3, list, m, ok, p, results, results1, search;
      search = document.querySelector("#projects-search input").value.toLowerCase();
      list = document.getElementById("project-list").childNodes;
      if (search.trim().length > 0) {
        results = [];
        for (l = 0, len2 = list.length; l < len2; l++) {
          p = list[l];
          if (p.dataset.title == null) {
            continue;
          }
          ok = p.dataset.title.toLowerCase().indexOf(search) >= 0;
          ok |= p.dataset.description.toLowerCase().indexOf(search) >= 0;
          ok |= p.dataset.tags.toLowerCase().indexOf(search) >= 0;
          ok |= p.dataset.public && "public".indexOf(search) >= 0;
          if (ok) {
            results.push(p.style.display = "inline-block");
          } else {
            results.push(p.style.display = "none");
          }
        }
        return results;
      } else {
        results1 = [];
        for (m = 0, len3 = list.length; m < len3; m++) {
          p = list[m];
          results1.push(p.style.display = "inline-block");
        }
        return results1;
      }
    });
    document.querySelector("#home-section").addEventListener("scroll", () => {
      var scroll;
      scroll = Math.min(60, document.querySelector("#home-section").scrollTop);
      return document.querySelector("#home-header-background").style.height = `${scroll}px`;
    });
    //document.querySelector("#home-section .part1").style["padding-top"] = "#{160-scroll}px"
    document.getElementById("myprojects").addEventListener("dragover", (event) => {
      return event.preventDefault();
    });
    document.getElementById("myprojects").addEventListener("drop", (event) => {
      event.preventDefault();
      if (event.dataTransfer.items && (event.dataTransfer.items[0] != null)) {
        return this.app.importProject(event.dataTransfer.items[0].getAsFile());
      }
    });
    this.createFullscreenFeatures();
    this.createProjectSideBarCollapse();
    setInterval((() => {
      return this.checkActivity();
    }), 10000);
    this.reboot_date = 1689163200000;
    this.checkRebootMessage();
  }

  checkRebootMessage() {
    var div, funk;
    if (this.reboot_date && Date.now() < this.reboot_date + 1000 * 60 * 2) {
      document.querySelector(".main-container").style.top = "100px";
      div = document.createElement("div");
      div.classList.add("meta-message");
      funk = () => {
        var hours, minutes;
        minutes = Math.max(0, this.reboot_date - Date.now()) / 60000;
        if (minutes >= 120) {
          hours = Math.floor(minutes / 60);
          return div.innerHTML = "<i class='fas fa-info-circle'></i> " + this.app.translator.get("microStudio will be down for server migration on %DATE% at %TIME%. Downtime will last a few minutes.").replace("%DATE%", new Date(this.reboot_date).toLocaleDateString()).replace("%TIME%", new Date(this.reboot_date).toLocaleTimeString());
        } else if (minutes >= 2) {
          minutes = Math.floor(minutes);
          return div.innerHTML = "<i class='fas fa-exclamation-circle'></i> " + this.app.translator.get("Downtime will start in %MINUTES% minutes").replace("%MINUTES%", minutes);
        } else {
          return div.innerHTML = "<i class='fas fa-exclamation-circle'></i> " + this.app.translator.get("Downtime will start immediately");
        }
      };
      funk();
      setInterval((() => {
        return funk();
      }), 30000);
      return document.body.appendChild(div);
    }
  }

  addWarningMessage(text, icon = "fa-exclamation-circle", id, dismissable) {
    var close, div, span;
    if (dismissable && id) {
      if (localStorage.getItem(id)) {
        return;
      }
    }
    div = document.createElement("div");
    div.classList.add("meta-message");
    span = document.createElement("span");
    span.innerHTML = `<i class='fas ${icon}'></i> ${text}`;
    if (dismissable) {
      close = document.createElement("i");
      close.classList.add("fa");
      close.classList.add("fa-times");
      close.addEventListener("click", () => {
        this.removeWarningMessage(div);
        if (id) {
          return localStorage.setItem(id, true);
        }
      });
      div.appendChild(close);
    }
    div.appendChild(span);
    this.warning_messages.push(div);
    document.querySelector(".main-container").style.top = `${60 + 40 * this.warning_messages.length}px`;
    document.body.appendChild(div);
    return this.layoutWarningMessages();
  }

  layoutWarningMessages() {
    var i, j, len, ref, results, w;
    ref = this.warning_messages;
    results = [];
    for (i = j = 0, len = ref.length; j < len; i = ++j) {
      w = ref[i];
      results.push(w.style.top = `${60 + i * 40}px`);
    }
    return results;
  }

  removeWarningMessage(div) {
    var index;
    if (document.body.contains(div)) {
      document.body.removeChild(div);
      index = this.warning_messages.indexOf(div);
      if (index >= 0) {
        this.warning_messages.splice(index, 1);
        document.querySelector(".main-container").style.top = `${60 + 40 * this.warning_messages.length}px`;
        return this.layoutWarningMessages();
      }
    }
  }

  checkActivity() {
    var t;
    t = Date.now() - this.last_activity;
    if (this.app.project != null) {
      if (t > 60 * 60 * 1000) {
        return this.backToProjectList(true);
      } else {
        return this.app.client.sendRequest({
          name: "ping"
        });
      }
    }
  }

  backToProjectList(useraction) {
    this.hide("projectview");
    this.show("myprojects");
    this.app.runwindow.projectClosed();
    this.app.debug.projectClosed();
    this.app.tab_manager.projectClosed();
    this.app.lib_manager.projectClosed();
    this.app.project = null;
    this.project = null;
    this.app.updateProjectList();
    if (useraction) {
      this.app.app_state.pushState("projects", "/projects/");
    }
    if (document.fullscreenElement) {
      return document.exitFullscreen();
    }
  }

  setSection(section, useraction) {
    var item, j, k, len, len1, list, menuitem, ref, s;
    if (this.makeProjectSideBarVisible != null) {
      this.makeProjectSideBarVisible();
    }
    this.current_section = section;
    ref = this.sections;
    for (j = 0, len = ref.length; j < len; j++) {
      s = ref[j];
      ((s) => {
        var element, menuitem;
        element = document.getElementById(`${s}-section`);
        menuitem = document.getElementById(`menuitem-${s}`);
        if ((element == null) || (menuitem == null)) {
          return;
        }
        if (s === section) {
          element.style.display = "block";
          menuitem.classList.add("selected");
        } else {
          element.style.display = "none";
          menuitem.classList.remove("selected");
        }
      })(s);
    }
    menuitem = document.getElementById(`menuitem-${section}`);
    if (menuitem != null) {
      menuitem.classList.add("selected");
    }
    list = document.querySelectorAll(".menuitem-plugin");
    for (k = 0, len1 = list.length; k < len1; k++) {
      item = list[k];
      if (item.id !== `menuitem-${section}`) {
        item.classList.remove("selected");
      }
    }
    this.app.tab_manager.setTabView(section);
    if (section === "sprites") {
      this.app.sprite_editor.spriteview.windowResized();
    }
    if (section === "code") {
      this.code_splitbar.update();
      this.server_splitbar.update();
      this.debug_splitbar.update();
      this.runtime_splitbar.update();
      this.app.runwindow.windowResized();
      this.app.editor.editor.resize();
      this.app.editor.update();
    }
    if (section === "sprites") {
      this.app.sprite_editor.update();
    }
    if (section === "maps") {
      this.app.map_editor.update();
    }
    if (section === "doc") {
      this.doc_splitbar.update();
      this.app.doc_editor.editor.resize();
      this.app.doc_editor.checkTutorial();
    }
    if (section === "sounds") {
      this.app.sound_editor.update();
    }
    if (section === "music") {
      this.app.music_editor.update();
    }
    if (section === "assets") {
      this.app.assets_manager.update();
    }
    if (section === "sync") {
      this.app.sync.update();
    }
    if (section === "options") {
      this.app.options.update();
    }
    app.editor.editor.setReadOnly(section !== "code");
    app.doc_editor.editor.setReadOnly(section !== "doc");
    if (useraction && (this.app.project != null)) {
      this.app.app_state.pushState(`project.${this.app.project.slug}.${section}`, `/projects/${this.app.project.slug}/${section}/`);
    }
    return this.app.runwindow.hideAll();
  }

  accountRequired(callback) {
    this.logged_callback = callback;
    this.setDisplay("login-overlay", "block");
    this.hide("login-panel");
    this.hide("create-account-panel");
    this.hide("forgot-password-panel");
    return this.show("guest-panel");
  }

  setMainSection(section, useraction = false) {
    var j, len, name, p, ref, s;
    if (section === "projects" && (this.app.user == null)) {
      this.accountRequired();
      return;
    }
    if (useraction) {
      if (section === "home") {
        this.app.app_state.pushState("home", this.app.translator.lang === "fr" ? "/fr" : "/");
      } else if (section === "projects" && (this.project != null) && (this.current_section != null)) {
        this.app.app_state.pushState(`project.${this.project.slug}.${this.current_section}`, `/projects/${this.project.slug}/${this.current_section}/`);
      } else if (section === "explore" && this.app.explore.project) {
        p = this.app.explore.project;
        this.app.app_state.pushState("project_details", `/i/${p.owner}/${p.slug}/`, {
          project: p
        });
      } else {
        name = {
          "help": "documentation"
        }[section] || section;
        if (name === "documentation") {
          this.app.documentation.pushState();
        } else if (name === "tutorials") {
          this.app.tutorials.tutorials_page.pushState();
        } else {
          this.app.app_state.pushState(name, `/${name}/`);
        }
      }
    }
    ref = this.menuoptions;
    for (j = 0, len = ref.length; j < len; j++) {
      s = ref[j];
      ((s) => {
        var element, menuitem;
        element = document.getElementById(`${s}-section`);
        menuitem = document.getElementById(`menu-${s}`);
        if (s === section) {
          element.style.display = "block";
          if (menuitem != null) {
            return menuitem.classList.add("selected");
          }
        } else {
          element.style.display = "none";
          if (menuitem != null) {
            return menuitem.classList.remove("selected");
          }
        }
      })(s);
    }
    if (section === "projects" && (this.app.project == null)) {
      this.hide("projectview");
      this.show("myprojects");
    }
    if (section === "projects") {
      this.code_splitbar.update();
      this.server_splitbar.update();
      this.debug_splitbar.update();
      this.runtime_splitbar.update();
      this.app.runwindow.windowResized();
    }
    if (section === "explore") {
      this.app.explore.update();
    } else {
      this.app.explore.closed();
    }
    if (section === "help") {
      this.app.documentation.updateViewPos();
    }
    if (section === "about") {
      this.app.about.setSection("about");
    }
    if (section === "tutorials") {
      this.app.tutorials.load();
    }
    //@app.explore.closeDetails() if section != "explore"
    this.app.runwindow.hideAll();
  }

  setDisplay(element, value) {
    return document.getElementById(element).style.display = value;
  }

  focus(element) {
    return document.getElementById(element).focus();
  }

  get(id) {
    return document.getElementById(id);
  }

  setAction(id, callback) {
    return this.get(id).addEventListener("click", (event) => {
      event.preventDefault();
      return callback(event);
    });
  }

  show(element) {
    return this.setDisplay(element, "block");
  }

  hide(element) {
    return this.setDisplay(element, "none");
  }

  createLoginFunctions() {
    var j, lang, len, ref, s1, s2, s3, s4;
    s1 = document.getElementById("switch_to_create_account");
    s2 = document.getElementById("switch_to_log_in");
    s3 = document.getElementById("switch_from_forgot_to_login");
    s4 = document.getElementById("forgot-password-link");
    s1.addEventListener("click", () => {
      this.setDisplay("create-account-panel", "block");
      return document.getElementById("login-panel").style.display = "none";
    });
    s2.addEventListener("click", () => {
      document.getElementById("create-account-panel").style.display = "none";
      return document.getElementById("login-panel").style.display = "block";
    });
    s3.addEventListener("click", () => {
      document.getElementById("forgot-password-panel").style.display = "none";
      return document.getElementById("login-panel").style.display = "block";
    });
    s4.addEventListener("click", () => {
      document.getElementById("forgot-password-panel").style.display = "block";
      return document.getElementById("login-panel").style.display = "none";
    });
    document.getElementById("login-window").addEventListener("click", (event) => {
      return event.stopPropagation();
    });
    document.getElementById("login-overlay").addEventListener("mousedown", (event) => {
      return document.getElementById("login-overlay").style.display = "none";
    });
    document.getElementById("login-window").addEventListener("mousedown", (event) => {
      return event.stopPropagation();
    });
    this.setAction("login-button", () => {
      return this.showLoginPanel();
    });
    this.setAction("guest-action-login", () => {
      return this.showLoginPanel();
    });
    this.setAction("guest-action-create", () => {
      return this.showCreateAccountPanel();
    });
    this.setAction("create-account-button", () => {
      return this.showCreateAccountPanel();
    });
    this.setAction("create-account-toggle-terms", () => {
      return this.toggleTerms();
    });
    this.setAction("guest-action-guest", () => {
      this.app.createGuest();
      return document.getElementById("login-overlay").style.display = "none";
    });
    document.querySelector(".username").addEventListener("mouseup", (event) => {
      return event.stopPropagation();
    });
    document.querySelector(".username").addEventListener("click", (event) => {
      var c, e, j, len, num, ref;
      e = document.querySelector(".usermenu");
      if (window.ms_standalone) {
        e.classList.add("standalone");
        e.classList.remove("regular");
      } else if (this.app.user.flags.guest || (this.app.user.email == null)) {
        e.classList.add("guest");
        e.classList.remove("regular");
      } else {
        e.classList.add("regular");
        e.classList.remove("guest");
      }
      if (e.style.height === "0px") {
        num = 0;
        ref = e.childNodes;
        for (j = 0, len = ref.length; j < len; j++) {
          c = ref[j];
          if (c.offsetParent != null) {
            num += 1;
          }
        }
        e.style.height = `${42 * num}px`;
        if (!this.usermenuclose) {
          return this.usermenuclose = document.body.addEventListener("mouseup", (event) => {
            return e.style.height = "0px";
          });
        }
      } else {
        return e.style.height = "0px";
      }
    });
    document.querySelector(".usermenu .logout").addEventListener("click", (event) => {
      return this.app.disconnect();
    });
    document.querySelector(".usermenu .settings").addEventListener("click", (event) => {
      return this.app.openUserSettings();
    });
    document.querySelector(".usermenu .profile").addEventListener("click", (event) => {
      return this.app.openUserProfile();
    });
    document.querySelector(".usermenu .progress").addEventListener("click", (event) => {
      return this.app.openUserProgress();
    });
    document.querySelector("#header-progress-summary").addEventListener("click", (event) => {
      return this.app.openUserProgress();
    });
    document.querySelector(".usermenu .create-account").addEventListener("click", (event) => {
      return this.showCreateAccountPanel();
    });
    document.querySelector(".usermenu .discard-account").addEventListener("click", (event) => {
      return this.app.disconnect();
    });
    document.querySelector("#language-setting").addEventListener("mouseup", (event) => {
      return event.stopPropagation();
    });
    this.createMainMenuFunction();
    document.querySelector("#language-setting").addEventListener("click", (event) => {
      var e;
      e = document.querySelector("#language-menu");
      if (!e.classList.contains("language-menu-open")) {
        e.classList.add("language-menu-open");
        if (!this.languagemenuclose) {
          return this.languagemenuclose = document.body.addEventListener("mouseup", (event) => {
            return e.classList.remove("language-menu-open");
          });
        }
      } else {
        return e.classList.remove("language-menu-open");
      }
    });
    ref = window.ms_languages;
    for (j = 0, len = ref.length; j < len; j++) {
      lang = ref[j];
      ((lang) => {
        if (document.querySelector(`#language-choice-${lang}`) != null) {
          document.querySelector(`#language-choice-${lang}`).addEventListener("click", (event) => {
            return this.setLanguage(lang);
          });
        }
        if (document.querySelector(`#switch-to-${lang}`) != null) {
          return document.querySelector(`#switch-to-${lang}`).addEventListener("click", (event) => {
            event.preventDefault();
            return this.setLanguage(lang);
          });
        }
      })(lang);
    }
    this.setAction("login-submit", () => {
      return this.app.login(this.get("login_nick").value, this.get("login_password").value);
    });
    this.setAction("create-account-submit", () => {
      if (!this.get("create-account-tos").checked) {
        return alert(this.app.translator.get("You must accept the terms of use in order to create an account."));
      }
      return this.app.createAccount(this.get("create_nick").value, this.get("create_email").value, this.get("create_password").value, this.get("create-account-newsletter").checked);
    });
    return this.setAction("forgot-submit", () => {
      return this.app.sendPasswordRecovery(document.getElementById("forgot_email").value);
    });
  }

  showLoginPanel() {
    this.setDisplay("login-overlay", "block");
    this.show("login-panel");
    this.hide("create-account-panel");
    this.hide("forgot-password-panel");
    return this.hide("guest-panel");
  }

  showCreateAccountPanel() {
    this.setDisplay("login-overlay", "block");
    this.hide("login-panel");
    this.show("create-account-panel");
    this.hide("forgot-password-panel");
    return this.hide("guest-panel");
  }

  userConnected(nick) {
    var text;
    if (this.nick === nick) {
      return;
    }
    this.hide("login-button");
    this.hide("create-account-button");
    this.nick = nick;
    if (this.app.user.flags.guest || (this.app.user.email == null)) {
      this.get("user-nick").innerHTML = this.app.translator.get("Guest");
      document.querySelector(".username i").classList.remove("fa-user");
      document.querySelector(".username i").classList.add("fa-user-clock");
      document.querySelector(".username").classList.add("guest");
    } else {
      document.querySelector(".username i").classList.add("fa-user");
      document.querySelector(".username i").classList.remove("fa-user-clock");
      document.querySelector(".username").classList.remove("guest");
      this.get("user-nick").innerHTML = nick;
      if (this.project != null) {
        this.updateProjectTitle();
        this.get("project-icon").src = location.origin + `/${this.project.owner.nick}/${this.project.slug}/${this.project.code}/icon.png`;
      }
      if (!this.app.user.flags.validated) {
        this.addWarningMessage(this.app.translator.get("Remember to validate your e-mail address"), "fa-exclamation-circle", "validate_email_" + Math.floor(Date.now() / 1000 / 3600 / 24 / 2), true);
      }
    }
    this.get("user-nick").style.display = "inline-block";
    //@show "user-info"
    this.show("login-info");
    this.hide("login-overlay");
    this.setMainSection("projects", location.pathname.length < 4); // home page with language variation => record jump to /projects/
    
    // @addWarningMessage """Join <a target="_blank" href="https://itch.io/jam/microstudio-mini-jam-2">microStudio mini-jam #2</a>! From October 24/25. More info in the <a target="_blank" href="https://microstudio.dev/community/news/mini-jam-2/235/">Community Forum</a> and <a target="_blank" href="https://discord.gg/BDMqjxd">Discord</a>""","fa-info-circle","mini_jam_2_#{Math.floor(Date.now()/1000/3600/12)}",true
    if (this.app.user.info.size > this.app.user.info.max_storage) {
      text = this.app.translator.get("Your account is out of space!");
      text += " " + this.app.translator.get("You are using %USED% of the %ALLOWED% you are allowed.").replace("%USED%", this.displayByteSize(this.app.user.info.size)).replace("%ALLOWED%", this.displayByteSize(this.app.user.info.max_storage));
      text += ` <a href='https://microstudio.dev/community/tips/your-account-is-out-of-space/109/' target='_blank'>${this.app.translator.get("More info...")}</a>`;
      return this.addWarningMessage(text, void 0, "out_of_storage", false);
    }
  }

  //if not @project?
  //  @show "myprojects"
  //  @hide "projectview"
  //@get("menu-projects").style.display = "inline-block"
  //@setMainSection "projects"
  userDisconnected() {
    this.get("login-button").style.display = "block";
    this.get("user-nick").innerHTML = "nick";
    //@hide "menu-projects"
    this.hide("login-info");
    this.nick = null;
    return this.project = null;
  }

  //@get("user-info").style.display = "none"
  showLoginButton() {
    this.get("login-button").style.display = "block";
    return this.get("create-account-button").style.display = "block";
  }

  popMenu() {
    return document.querySelector("header").style.transform = "translateY(0%)";
  }

  createProjectBox(p) {
    var buttons, clone_button, delete_button, element, export_button, export_href, icon, pill, size, sizepill, title;
    element = document.createElement("a");
    element.classList.add("project-box");
    element.id = `project-box-${p.slug}`;
    element.href = `/projects/${p.slug}/code/`;
    element.dataset.title = p.title;
    element.dataset.description = p.description;
    element.dataset.tags = p.tags.join(",");
    if (p.public) {
      element.dataset.public = p.public;
    }
    buttons = document.createElement("div");
    buttons.classList.add("buttons");
    element.appendChild(buttons);
    if (p.size) {
      size = this.displayByteSize(p.size);
      sizepill = document.createElement("div");
      sizepill.innerText = size;
      sizepill.classList.add("pill", "bg-blue", "shadow5", 'marginbottom10', 'marginright10');
      buttons.appendChild(sizepill);
    }
    if (p.public) {
      pill = document.createElement("div");
      pill.innerHTML = "<i class=\"fa fa-eye\"></i> " + this.app.translator.get("public");
      pill.classList.add("pill", "bg-purple", "shadow5", 'marginbottom10');
      buttons.appendChild(pill);
    }
    export_href = `/${p.owner.nick}/${p.slug}/${p.code}/export/project/`;
    export_button = document.createElement("div");
    export_button.classList.add("button", "export", "shadow5");
    export_button.innerHTML = `<a href='${export_href}' download='${p.slug}_files.zip'><i class='fa fa-download'></i> ${this.app.translator.get("Export")}</a>`;
    buttons.appendChild(export_button);
    export_button.addEventListener("click", (event) => {
      event.stopPropagation();
      return event.stopImmediatePropagation();
    });
    clone_button = document.createElement("div");
    clone_button.classList.add("button", "clone", "shadow5");
    clone_button.innerHTML = `<i class='fa fa-copy'></i> ${this.app.translator.get("Clone")}`;
    buttons.appendChild(clone_button);
    clone_button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      return ConfirmDialog.confirm(this.app.translator.get("Do you want to clone this project?"), this.app.translator.get("Clone"), this.app.translator.get("Cancel"), () => {
        return this.app.cloneProject(p);
      });
    });
    delete_button = document.createElement("div");
    delete_button.classList.add("button", "delete", "shadow5");
    if (p.owner.nick === this.app.nick) {
      delete_button.innerHTML = `<i class='fa fa-trash-alt'></i> ${this.app.translator.get("Delete")}`;
    } else {
      delete_button.innerHTML = `<i class='fa fa-times'></i> ${this.app.translator.get("Quit")}`;
    }
    buttons.appendChild(delete_button);
    delete_button.addEventListener("click", (event) => {
      var msg, ok;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      msg = p.owner.nick === this.app.nick ? this.app.translator.get("Really delete this project?") : this.app.translator.get("Really quit this project?");
      ok = p.owner.nick === this.app.nick ? this.app.translator.get("Delete") : this.app.translator.get("Quit");
      return ConfirmDialog.confirm(msg, ok, this.app.translator.get("Cancel"), () => {
        return this.app.deleteProject(p);
      });
    });
    title = document.createElement("div");
    title.classList.add("project-title");
    title.innerText = p.title;
    element.appendChild(title);
    element.appendChild(document.createElement("br"));
    icon = new Image;
    icon.src = location.origin + `/${p.owner.nick}/${p.slug}/${p.code}/icon.png`;
    icon.classList.add("pixelated");
    element.appendChild(icon);
    if (p.poster) {
      element.style.background = `linear-gradient(to bottom, hsla(200,20%,20%,0.6), hsla(200,20%,20%,0.9)),url(/${p.owner.nick}/${p.slug}/${p.code}/poster.png)`;
      element.style["background-size"] = "cover";
      element.style["background-opacity"] = .5;
      icon.style.width = "104px";
      icon.style.height = "104px";
      icon.style["margin-top"] = "40px";
      icon.style["box-shadow"] = "0 0 10px 1px #000";
    }
    element.addEventListener("click", (event) => {
      if (!event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        return this.app.openProject(p);
      }
    });
    return element;
  }

  updateProjects() {
    var c, count, div, e, element, h2, j, k, len, len1, list, p, pending, ref;
    list = this.get("project-list");
    list.innerHTML = "";
    if (this.app.projects == null) {
      return;
    }
    document.querySelector("#projects-search input").value = "";
    this.app.projects.sort(function(a, b) {
      return b.last_modified - a.last_modified;
    });
    pending = [];
    count = 0;
    ref = this.app.projects;
    for (j = 0, len = ref.length; j < len; j++) {
      p = ref[j];
      if (p.owner.nick === this.app.nick || p.accepted) {
        element = this.createProjectBox(p);
        list.appendChild(element);
        count++;
      } else {
        pending.push(p);
      }
    }
    if (count === 0) {
      h2 = document.createElement("h2");
      h2.innerHTML = this.app.translator.get("Your projects will be displayed here.") + "<br />" + this.app.translator.get("Time to create your first project!");
      list.appendChild(h2);
    }
    if (pending.length > 0) {
      div = document.createElement("div");
      div.classList.add("project-invites-list");
      div.innerHTML = "<h2><i class='fa fa-users'></i> Pending invitations</h2>";
      for (k = 0, len1 = pending.length; k < len1; k++) {
        p = pending[k];
        e = document.createElement("div");
        e.classList.add("invite");
        e.innerHTML = `<div class="buttons">\n   <div class="accept" title="Accept" onclick="app.appui.acceptInvite(${p.id})"><i class="fa fa-check"></i></div><div class="reject" title="Reject" onclick="app.appui.rejectInvite(${p.id})"><i class="fa fa-times"></i></div>\n</div>\n<img src="/${p.owner.nick}/${p.slug}/${p.code}/icon.png"/> ${p.title} by ${p.owner.nick}`;
        div.appendChild(e);
      }
      list.insertBefore(div, list.firstChild);
    }
    //# create list of projects to accept or reject
    if (this.logged_callback != null) {
      c = this.logged_callback;
      this.logged_callback = null;
      c();
    } else {
      this.app.app_state.projectsFetched();
    }
  }

  acceptInvite(projectid) {
    var j, len, p, ref;
    ref = this.app.projects;
    for (j = 0, len = ref.length; j < len; j++) {
      p = ref[j];
      if (p.id === projectid && p.owner.nick !== this.app.nick && !p.accepted) {
        this.app.client.sendRequest({
          name: "accept_invite",
          project: projectid
        });
      }
    }
  }

  rejectInvite(projectid) {
    var j, len, p, ref;
    ref = this.app.projects;
    for (j = 0, len = ref.length; j < len; j++) {
      p = ref[j];
      if (p.id === projectid && p.owner.nick !== this.app.nick) {
        this.app.client.sendRequest({
          name: "remove_project_user",
          user: this.app.nick,
          project: projectid
        });
      }
    }
  }

  setProject(project1, useraction = true) {
    var j, len, ref, t, tab;
    this.project = project1;
    this.updateProjectTitle();
    this.get("project-icon").src = location.origin + `/${this.project.owner.nick}/${this.project.slug}/${this.project.code}/icon.png`;
    tab = "code";
    if ((this.project.tabs != null) && !this.app.tab_manager.isTabActive("code")) {
      tab = "options";
      ref = this.sections;
      for (j = 0, len = ref.length; j < len; j++) {
        t = ref[j];
        if (this.app.tab_manager.isTabActive(t)) {
          tab = t;
          break;
        }
      }
    }
    this.setSection(tab, useraction);
    this.show("projectview");
    this.hide("myprojects");
    this.project.addListener(this);
    this.code_splitbar.initPosition(50);
    this.debug_splitbar.closed2 = true;
    this.debug_splitbar.update();
    this.runtime_splitbar.initPosition(50);
    this.server_splitbar.initPosition(50);
    this.app.runwindow.terminal.start();
    this.updateActiveUsers();
    return this.doc_splitbar.initPosition(50);
  }

  updateProjectTitle() {
    var html;
    if (this.project != null) {
      html = this.project.title;
      if (this.project.public) {
        html += ` <div class="pill bg-purple shadow5 marginleft10"><i class="fa fa-eye"></i> ${this.app.translator.get("public")}</div>`;
      }
      return this.get("project-name").innerHTML = html;
    }
  }

  projectUpdate(change) {
    var icon, img;
    if (change === "spritelist") {
      icon = this.project.getSprite("icon");
      if (icon != null) {
        icon.addImage(this.get("project-icon"), 32);
        img = document.querySelector(`#project-box-${this.project.slug} img`);
        if (img != null) {
          return icon.addImage(img, 144);
        }
      }
    } else if (change === "title" || change === "public") {
      return this.updateProjectTitle();
    } else if (change === "locks") {
      return this.updateActiveUsers();
    }
  }

  updateActiveUsers() {
    var div, e, element, i, j, key, list, name, names, ref, span;
    element = document.querySelector(".projectheader #active-project-users");
    list = element.childNodes;
    names = {};
    for (i = j = ref = list.length - 1; j >= 0; i = j += -1) {
      e = list[i];
      name = e.id.split("-")[2];
      if (this.project.friends[name] == null) {
        element.removeChild(e);
      } else {
        names[name] = true;
      }
    }
    for (key in this.project.friends) {
      if (!names[key]) {
        div = document.createElement("div");
        div.style = `background:${this.createFriendColor(key)}`;
        div.id = `active-user-${key}`;
        i = document.createElement("i");
        i.classList.add("fa");
        i.classList.add("fa-user");
        div.appendChild(i);
        span = document.createElement("span");
        span.innerText = key;
        div.appendChild(span);
        element.appendChild(div);
      }
    }
  }

  createFriendColor(friend) {
    var i, j, ref, seed;
    seed = 137;
    for (i = j = 0, ref = friend.length - 1; j <= ref; i = j += 1) {
      seed = (seed + friend.charCodeAt(i) * 31 + 97) % 360;
    }
    return `hsl(${seed},50%,50%)`;
  }

  startSaveStatus() {
    this.savetick = 0;
    return setInterval((() => {
      return this.checkSaveStatus();
    }), 500);
  }

  checkSaveStatus() {
    var e, t;
    if (this.project == null) {
      return;
    }
    e = document.getElementById("save-status");
    switch (this.save_status) {
      case "saving":
        if (this.project.pending_changes.length === 0) {
          this.save_status = "saved";
          e.classList.remove("fa-ellipsis-h");
          e.classList.add("fa-check");
          e.style.color = "hsl(160,50%,70%)";
          e.style.opacity = 1;
          return e.style.transform = "scale(1.1)";
        } else {
          this.savetick = (this.savetick + 1) % 2;
          t = .9 + this.savetick * .2;
          return e.style.transform = `scale(${t})`;
        }
        break;
      case "saved":
        e.style.opacity = 0;
        e.style.transform = "scale(.9)";
        return this.save_status = "";
      default:
        if (this.project.pending_changes.length > 0) {
          this.save_status = "saving";
          e.classList.add("fa-ellipsis-h");
          e.classList.remove("fa-check");
          e.style.color = "hsl(0,50%,70%)";
          e.style.opacity = 1;
          return e.style.transform = "scale(1)";
        }
    }
  }

  toggleTerms() {
    if (this.terms_shown) {
      this.terms_shown = false;
      return this.get("create-account-terms").style.display = "none";
    } else {
      this.terms_shown = true;
      this.get("create-account-terms").style.display = "block";
      return this.app.about.load("terms", (text) => {
        return this.get("create-account-terms").innerHTML = DOMPurify.sanitize(marked(text));
      });
    }
  }

  showNotification(text) {
    document.querySelector("#notification-bubble span").innerText = text;
    document.getElementById("notification-container").style.transform = "translateY(0px)";
    return setTimeout((() => {
      return document.getElementById("notification-container").style.transform = "translateY(-150px)";
    }), 5000);
  }

  setLanguage(lang) {
    var date;
    if ((document.cookie != null) && document.cookie.indexOf(`language=${lang}`) >= 0) {
      return;
    }
    date = new Date();
    date.setTime(date.getTime() + 1000 * 3600 * 24 * 60);
    document.cookie = `language=${lang};expires=${date.toUTCString()};path=/`;
    return window.location = location.origin + (lang !== "en" ? `/${lang}/` : ""); //+"?t=#{Date.now()}"
  }

  displayByteSize(size) {
    if (size < 1000) {
      return `${size} ${this.app.translator.get("Bytes")}`;
    } else if (size < 10000) {
      return `${(size / 1000).toFixed(1)} ${this.app.translator.get("Kb")}`;
    } else if (size < 1000000) {
      return `${Math.floor(size / 1000)} ${this.app.translator.get("Kb")}`;
    } else if (size < 10000000) {
      return `${(size / 1000000).toFixed(1)} ${this.app.translator.get("Mb")}`;
    } else if (size < 1000000000) {
      return `${Math.floor(size / 1000000)} ${this.app.translator.get("Mb")}`;
    } else {
      return `${(size / 1000000000).toFixed(1)} ${this.app.translator.get("Gb")}`;
    }
  }

  createUserTag(nick, tier, pic = false, picmargin) {
    var div, i, icon, span;
    div = document.createElement("a");
    div.classList.add("usertag");
    if (tier) {
      div.classList.add(tier);
    }
    i = document.createElement("i");
    i.classList.add("fa");
    i.classList.add("fa-user");
    div.appendChild(i);
    span = document.createElement("span");
    span.innerText = nick;
    div.appendChild(span);
    if (tier) {
      icon = new Image;
      icon.src = location.origin + `/microstudio/patreon/badges/sprites/${tier}.png`;
      icon.classList.add("pixelated");
      icon.style = "width: 32px; height: 32px;";
      icon.alt = icon.title = this.app.getTierName(tier);
      div.appendChild(icon);
    }
    div.href = `/${nick}/`;
    div.target = "_blank";
    div.addEventListener("click", function(event) {
      return event.stopPropagation();
    });
    if (pic) {
      pic = document.createElement("img");
      pic.src = `/${nick}.png`;
      pic.classList.add("profile");
      div.appendChild(pic);
      if (picmargin) {
        div.style["margin-left"] = `${picmargin}px`;
      }
    }
    return div;
  }

  setImportProgress(progress) {
    document.getElementById("import-project-button").innerHTML = "<i class=\"fa fa-upload\"></i> Uploading... ";
    progress = Math.round(progress);
    return document.getElementById("import-project-button").style.background = `linear-gradient(90deg,hsl(200,50%,40%) 0%,hsl(200,50%,40%) ${progress}%,hsl(200,20%,20%) ${progress}%)`;
  }

  resetImportButton() {
    document.getElementById("import-project-button").innerHTML = `<i class="fa fa-upload"></i> ${this.app.translator.get("Import Project")}`;
    return document.getElementById("import-project-button").style.removeProperty("background");
  }

  bumpElement(select) {
    var element, interval, start;
    element = document.querySelector(select);
    if (element != null) {
      start = Date.now();
      return interval = setInterval((function() {
        var d, s, t;
        t = (Date.now() - start) / 300;
        if (t >= 1) {
          element.style.transform = "none";
          return clearInterval(interval);
        } else {
          t = Math.pow(t, .8);
          s = 1 + .5 * Math.sin(t * Math.PI);
          d = -.5 * Math.sin(t * Math.PI) * 20;
          return element.style.transform = `scale(${s}) rotateZ(${d}deg)`;
        }
      }), 16);
    }
  }

  createFullscreenFeatures() {
    var button;
    button = document.getElementById("project-fullscreen");
    button.addEventListener("click", () => {
      if (document.fullscreenElement) {
        return document.exitFullscreen();
      } else {
        document.getElementById("projectview").requestFullscreen();
        return document.getElementById("projectview").style.background = "hsl(200,20%,15%)";
      }
    });
    return window.addEventListener("fullscreenchange", () => {
      if (document.fullscreenElement) {
        button.classList.remove("fa-expand");
        return button.classList.add("fa-compress");
      } else {
        button.classList.add("fa-expand");
        button.classList.remove("fa-compress");
        return document.getElementById("projectview").style.background = "none";
      }
    });
  }

  createMainMenuFunction() {
    var bump, button, closing, displayed, menu, resize;
    button = document.getElementById("main-menu-button");
    menu = document.querySelector(".titlemenu");
    closing = false;
    displayed = false;
    bump = () => {
      var f, t;
      t = Date.now();
      f = () => {
        var rr, tt;
        tt = Date.now() - t;
        if (tt < 250) {
          tt = 1 - tt / 250;
          tt = Math.pow(tt, 2);
          rr = tt;
          tt = 1 + tt * .5;
          button.style.transform = `scale(${tt},${tt}) rotate(${-rr * 10}deg)`;
          return setTimeout(f, 16);
        } else {
          return button.style.transform = "none";
        }
      };
      return f();
    };
    button.addEventListener("click", (event) => {
      if (menu.style.left !== "0%" && !closing) {
        menu.style.left = "0%";
        return bump();
      } else {
        menu.style.left = "-100%";
        return bump();
      }
    });
    document.addEventListener("mouseup", () => {
      if ((button.offsetParent != null) && menu.style.left !== "-100%") {
        menu.style.left = "-100%";
        closing = true;
        return bump();
      } else {
        return closing = false;
      }
    });
    resize = () => {
      if (button.offsetParent == null) {
        menu.style.left = "0px";
        return displayed = false;
      } else if (menu.style.left !== "0%") {
        menu.style.left = "-100%";
        if (!displayed) {
          displayed = true;
          return bump();
        }
      }
    };
    window.addEventListener("resize", resize);
    return resize();
  }

  createProjectSideBarCollapse() {
    var collapse_time, resize_until;
    collapse_time = 0;
    resize_until = Date.now();
    this.makeProjectSideBarVisible = () => {
      if (document.getElementById("projectview").classList.contains("sidebar-collapsed")) {
        document.getElementById("projectview").classList.remove("sidebar-collapsed");
        window.dispatchEvent(new Event('resize'));
      }
      if (window.innerWidth < 600) {
        return collapse_time = Date.now() + 3000;
      }
    };
    window.addEventListener("resize", () => {
      if (!document.getElementById("projectview").classList.contains("sidebar-collapsed") && window.innerWidth < 600) {
        return collapse_time = Date.now() + 3000;
      } else if (document.getElementById("projectview").classList.contains("sidebar-collapsed") && window.innerWidth >= 600) {
        return this.makeProjectSideBarVisible();
      }
    });
    return setInterval((() => {
      if (Date.now() < resize_until) {
        window.dispatchEvent(new Event('resize'));
      }
      if (collapse_time && Date.now() > collapse_time) {
        collapse_time = 0;
        if (window.innerWidth < 600) {
          document.getElementById("projectview").classList.add("sidebar-collapsed");
          return window.dispatchEvent(new Event('resize'));
        }
      }
    }), 500);
  }

  createProjectLikesButton(element, project) {
    var e, likes;
    e = element.querySelector(".likes-button");
    if (e) {
      e.parentNode.removeChild(e);
    }
    likes = document.createElement("div");
    likes.classList.add("likes-button");
    likes.innerHTML = "<i class='fa fa-thumbs-up'></i> " + project.likes;
    if (project.liked) {
      likes.classList.add("liked");
    }
    element.appendChild(likes);
    return likes.addEventListener("click", () => {
      event.stopImmediatePropagation();
      if (!this.app.user.flags.validated) {
        return alert(this.app.translator.get("Validate your e-mail address to enable votes."));
      }
      return this.app.client.sendRequest({
        name: "toggle_like",
        project: project.id
      }, (msg) => {
        if (msg.name === "project_likes") {
          project.likes = msg.likes;
          project.liked = msg.liked;
          return this.createProjectLikesButton(element, project);
        }
      });
    });
  }

};

var App, app;

app = null;

window.addEventListener("load", function() {
  return app = new App();
});

App = class App {
  constructor() {
    this.languages = {
      microscript2: LANGUAGE_MICROSCRIPT2,
      microscript: LANGUAGE_MICROSCRIPT,
      python: LANGUAGE_PYTHON,
      javascript: LANGUAGE_JAVASCRIPT,
      lua: LANGUAGE_LUA
    };
    this.translator = new Translator(this);
    this.app_state = new AppState(this);
    this.appui = new AppUI(this);
    this.explore = new Explore(this);
    this.client = new Client(this);
    this.user_progress = new UserProgress(this);
    this.about = new About(this);
    this.documentation = new Documentation(this);
    this.editor = new Editor(this);
    this.doc_editor = new DocEditor(this);
    this.sprite_editor = new SpriteEditor(this);
    this.map_editor = new MapEditor(this);
    this.assets_manager = new AssetsManager(this);
    this.sound_editor = new SoundEditor(this);
    this.music_editor = new MusicEditor(this);
    this.runwindow = new RunWindow(this);
    this.debug = new Debug(this);
    this.options = new Options(this);
    this.tab_manager = new TabManager(this);
    this.lib_manager = new LibManager(this);
    this.sync = new Sync(this);
    this.publish = new Publish(this);
    this.user_settings = new UserSettings(this);
    this.connected = false;
    this.tutorial = new TutorialWindow(this);
    this.tutorials = new Tutorials(this);
    this.client.start();
  }

  setToken(token, username) {
    this.token = token;
    this.username = username;
    return this.client.setToken(this.token);
  }

  createGuest() {
    return this.client.sendRequest({
      name: "create_guest",
      language: window.navigator.language != null ? window.navigator.language.substring(0, 2) : "en"
    }, (msg) => {
      switch (msg.name) {
        case "error":
          console.error(msg.error);
          if (msg.error != null) {
            return alert(this.translator.get(msg.error));
          }
          break;
        case "guest_created":
          this.setToken(msg.token);
          this.nick = msg.nick;
          this.user = {
            nick: msg.nick,
            flags: msg.flags,
            settings: msg.settings,
            info: msg.info
          };
          this.connected = true;
          return this.userConnected(msg.nick);
      }
    });
  }

  createAccount(nick, email, password, newsletter) {
    return this.client.sendRequest({
      name: "create_account",
      nick: nick,
      email: email,
      password: password,
      newsletter: newsletter,
      language: window.navigator.language != null ? window.navigator.language.substring(0, 2) : "en"
    }, (msg) => {
      switch (msg.name) {
        case "error":
          console.error(msg.error);
          if (msg.error != null) {
            return alert(this.translator.get(msg.error));
          }
          break;
        case "account_created":
          this.setToken(msg.token);
          this.nick = nick;
          this.user = {
            nick: msg.nick,
            email: msg.email,
            flags: msg.flags,
            settings: msg.settings,
            info: msg.info
          };
          this.connected = true;
          return this.userConnected(nick);
      }
    });
  }

  login(nick, password) {
    return this.client.sendRequest({
      name: "login",
      nick: nick,
      password: password
    }, (msg) => {
      var i, len, n, ref;
      switch (msg.name) {
        case "error":
          console.error(msg.error);
          if (msg.error != null) {
            return alert(this.translator.get(msg.error));
          }
          break;
        case "logged_in":
          this.setToken(msg.token);
          this.nick = msg.nick;
          this.user = {
            nick: msg.nick,
            email: msg.email,
            flags: msg.flags,
            settings: msg.settings,
            info: msg.info
          };
          if ((msg.notifications != null) && msg.notifications.length > 0) {
            ref = msg.notifications;
            for (i = 0, len = ref.length; i < len; i++) {
              n = ref[i];
              this.appui.showNotification(n);
            }
          }
          this.connected = true;
          this.userConnected(msg.nick);
          return this.appui.showNotification(this.translator.get("Welcome back!"));
      }
    });
  }

  sendPasswordRecovery(email) {
    if (!RegexLib.email.test(email)) {
      return alert(this.translator.get("incorrect email"));
    } else {
      return this.client.sendRequest({
        name: "send_password_recovery",
        email: email
      }, (msg) => {
        document.getElementById("forgot-password-panel").innerHTML = this.translator.get("Thank you. Please check your mail.");
        return setTimeout((() => {
          return this.appui.hide("login-overlay");
        }), 5000);
      });
    }
  }

  createProject(title, slug, options, callback) {
    if ((options != null) && typeof options === "function" && (callback == null)) {
      callback = options;
      options = {
        language: "microscript_v2"
      };
    }
    return this.client.sendRequest({
      name: "create_project",
      title: title,
      slug: slug,
      type: options.type,
      graphics: options.graphics,
      language: options.language,
      networking: options.networking,
      libs: options.libs
    }, (msg) => {
      switch (msg.name) {
        case "error":
          console.error(msg.error);
          if (msg.error != null) {
            alert(this.translator.get(msg.error));
          }
          break;
        case "project_created":
          this.getProjectList((list) => {
            var i, len, p, results;
            this.projects = list;
            this.appui.updateProjects();
            results = [];
            for (i = 0, len = list.length; i < len; i++) {
              p = list[i];
              if (p.id === msg.id) {
                this.openProject(p);
                if (callback != null) {
                  results.push(callback());
                } else {
                  results.push(void 0);
                }
              } else {
                results.push(void 0);
              }
            }
            return results;
          });
      }
    });
  }

  importProject(file) {
    var reader;
    if (this.importing) {
      return;
    }
    console.info(`importing ${file.name}`);
    reader = new FileReader();
    reader.addEventListener("load", () => {
      // return if not reader.result.startsWith("data:application/x-zip-compressed;base64,")
      // mime-type returned by browser may vary ; let's just check ZIP extension
      if (!file.name.toLowerCase().endsWith(".zip")) {
        return;
      }
      this.importing = true;
      return this.client.sendUpload({
        name: "import_project"
      }, reader.result, ((msg) => {
        console.log(`[ZIP] ${msg.name}`);
        switch (msg.name) {
          case "error":
            this.appui.showNotification(this.translator.get(msg.error));
            this.appui.resetImportButton();
            return this.importing = false;
          case "project_imported":
            this.updateProjectList(msg.id);
            this.appui.showNotification(this.translator.get("Project imported successfully"));
            this.appui.resetImportButton();
            this.importing = false;
            this.tab_manager.resetPlugins();
            return this.lib_manager.resetLibs();
        }
      }), (progress) => {
        return this.appui.setImportProgress(progress);
      });
    });
    return reader.readAsArrayBuffer(file);
  }

  updateProjectList(open_when_fetched) {
    return this.getProjectList((list) => {
      var i, len, p, ref, results;
      this.projects = list;
      this.appui.updateProjects();
      if (open_when_fetched != null) {
        ref = this.projects;
        results = [];
        for (i = 0, len = ref.length; i < len; i++) {
          p = ref[i];
          if (p.id === open_when_fetched) {
            this.openProject(p);
            break;
          } else {
            results.push(void 0);
          }
        }
        return results;
      }
    });
  }

  getProjectList(callback) {
    return this.client.sendRequest({
      name: "get_project_list"
    }, (msg) => {
      if (callback != null) {
        return callback(msg.list);
      }
    });
  }

  openProject(project, useraction = true) {
    var t, tuto;
    this.project = new Project(this, project);
    this.appui.setProject(this.project, useraction);
    this.editor.setCode("");
    this.editor.projectOpened();
    this.sprite_editor.projectOpened();
    this.map_editor.projectOpened();
    this.sound_editor.projectOpened();
    this.music_editor.projectOpened();
    this.assets_manager.projectOpened();
    this.runwindow.projectOpened();
    this.debug.projectOpened();
    this.options.projectOpened();
    this.tab_manager.projectOpened();
    this.lib_manager.projectOpened();
    this.sync.projectOpened();
    this.publish.loadProject(this.project);
    this.project.load();
    if (!this.tutorial.shown) {
      tuto = this.getProjectTutorial(project.slug);
      if (tuto != null) {
        t = new Tutorial(tuto);
        return t.load(() => {
          return this.tutorial.start(t);
        });
      }
    }
  }

  deleteProject(project) {
    if (project.owner.nick === this.nick) {
      return this.client.sendRequest({
        name: "delete_project",
        project: project.id
      }, (msg) => {
        return this.updateProjectList();
      });
    } else {
      return this.client.sendRequest({
        name: "remove_project_user",
        project: project.id,
        user: this.nick
      });
    }
  }

  projectTitleExists(title) {
    var i, len, p, ref;
    if (!this.projects) {
      return false;
    }
    ref = this.projects;
    for (i = 0, len = ref.length; i < len; i++) {
      p = ref[i];
      if (p.title === title) {
        return true;
      }
    }
    return false;
  }

  cloneProject(project) {
    var count, title;
    title = project.title + ` (${this.translator.get("copy")})`;
    count = 1;
    while (this.projectTitleExists(title)) {
      count += 1;
      title = project.title + ` (${this.translator.get("copy")} ${count})`;
    }
    return this.client.sendRequest({
      name: "clone_project",
      project: project.id,
      title: title
    }, (msg) => {
      this.appui.setMainSection("projects");
      this.appui.backToProjectList();
      this.updateProjectList();
      return this.appui.showNotification(this.translator.get("Project cloned! Here is your copy."));
    });
  }

  writeProjectFile(project_id, file, content, callback) {
    return this.client.sendRequest({
      name: "write_project_file",
      project: project_id,
      file: file,
      content: content
    }, (msg) => {});
  }

  readProjectFile(project_id, file, callback) {
    return this.client.sendRequest({
      name: "read_project_file",
      project: project_id,
      file: file
    }, (msg) => {
      return callback(msg.content);
    });
  }

  //listProjectFiles:(project_id,folder,callback)->
  //  @client.sendRequest {
  //    name:"list_project_files"
  //    project: project_id
  //    folder: folder
  //  },(msg)=>
  //    callback msg.content
  userConnected(nick) {
    this.appui.userConnected(nick);
    this.updateProjectList();
    this.user_settings.update();
    return this.user_progress.init();
  }

  disconnect() {
    if ((this.user.email == null) || this.user.flags.guest) {
      return this.client.sendRequest({
        name: "delete_guest"
      }, (msg) => {
        this.setToken(null);
        return location.reload();
      });
    } else {
      this.setToken(null);
      return location.reload();
    }
  }

  fetchPublicProjects() {
    return this.client.sendRequest({
      name: "get_public_projects",
      ranking: "hot",
      tags: []
    }, (msg) => {});
  }

  serverMessage(msg) {
    switch (msg.name) {
      case "project_user_list":
        return this.updateProjectUserList(msg);
      case "project_list":
        this.projects = msg.list;
        return this.appui.updateProjects();
      case "project_file_locked":
        if ((this.project != null) && msg.project === this.project.id) {
          return this.project.fileLocked(msg);
        }
        break;
      case "project_file_update":
        if ((this.project != null) && msg.project === this.project.id) {
          return this.project.fileUpdated(msg);
        }
        break;
      case "project_file_deleted":
        if ((this.project != null) && msg.project === this.project.id) {
          return this.project.fileDeleted(msg);
        }
        break;
      case "project_options_updated":
        if ((this.project != null) && msg.project === this.project.id) {
          this.project.optionsUpdated(msg);
          this.options.projectOpened();
          this.tab_manager.projectOpened();
          return this.lib_manager.projectOpened();
        }
        break;
      case "user_stats":
        if (this.user != null) {
          this.user.info.stats = msg.stats;
          this.user_progress.update();
          return this.user_progress.updateStatsPage();
        }
        break;
      case "achievements":
        if (this.user != null) {
          this.user.info.achievements = msg.achievements;
          return this.user_progress.checkAchievements();
        }
        break;
      case "show_error":
        return this.appui.showNotification(this.translator.get(msg.error));
    }
  }

  updateProjectUserList(msg) {
    if ((this.project != null) && msg.project === this.project.id) {
      this.project.users = msg.users;
      return this.options.updateUserList();
    }
  }

  getUserSetting(setting) {
    if ((this.user != null) && (this.user.settings != null)) {
      return this.user.settings[setting];
    } else {
      return null;
    }
  }

  setUserSetting(setting, value) {
    if (this.user != null) {
      if (this.user.settings == null) {
        this.user.settings = {};
      }
      this.user.settings[setting] = value;
      return this.client.sendRequest({
        name: "set_user_setting",
        setting: setting,
        value: value
      }, (msg) => {});
    }
  }

  setTutorialProgress(tutorial_id, progress) {
    var tutorial_progress;
    tutorial_progress = this.getUserSetting("tutorial_progress");
    if (tutorial_progress == null) {
      tutorial_progress = {};
    }
    tutorial_progress[tutorial_id] = progress;
    return this.setUserSetting("tutorial_progress", tutorial_progress);
  }

  getTutorialProgress(tutorial_id) {
    var tutorial_progress;
    tutorial_progress = this.getUserSetting("tutorial_progress");
    if (tutorial_progress == null) {
      return 0;
    } else {
      return tutorial_progress[tutorial_id] || 0;
    }
  }

  setProjectTutorial(project_slug, tutorial_id) {
    var project_tutorial;
    project_tutorial = this.getUserSetting("project_tutorial");
    if (project_tutorial == null) {
      project_tutorial = {};
    }
    project_tutorial[project_slug] = tutorial_id;
    return this.setUserSetting("project_tutorial", project_tutorial);
  }

  getProjectTutorial(slug) {
    var project_tutorial;
    project_tutorial = this.getUserSetting("project_tutorial");
    if (project_tutorial == null) {
      return null;
    } else {
      return project_tutorial[slug];
    }
  }

  setHomeState() {
    if (this.translator.lang !== "en") {
      return history.replaceState(null, "microStudio", `/${this.translator.lang}/`);
    } else {
      return history.replaceState(null, "microStudio", "/");
    }
  }

  setState(state) {}

  getTierName(tier) {
    switch (tier) {
      case "pixel_master":
        return "Pixel Master";
      case "code_ninja":
        return "Code Ninja";
      case "gamedev_lord":
        return "Gamedev Lord";
      case "founder":
        return "Founder";
      case "sponsor":
        return "Sponsor";
      default:
        return "Standard";
    }
    return "";
  }

  openUserSettings() {
    this.appui.setMainSection("usersettings");
    this.user_settings.setSection("settings");
    return this.app_state.pushState("user.settings", "/user/settings/");
  }

  openUserProfile() {
    this.appui.setMainSection("usersettings");
    this.user_settings.setSection("profile");
    return this.app_state.pushState("user.profile", "/user/profile/");
  }

  openUserProgress() {
    this.appui.setMainSection("usersettings");
    this.user_settings.setSection("progress");
    return this.app_state.pushState("user.progress", "/user/progress/");
  }

};

if (navigator.serviceWorker != null) {
  navigator.serviceWorker.register("/app_sw.js", {
    scope: location.pathname
  }).then(function(reg) {
    return console.log('Registration succeeded. Scope is' + reg.scope);
  }).catch(function(error) {
    return console.log('Registration failed with' + error);
  });
}

this.AppState = class AppState {
  constructor(app) {
    this.app = app;
    window.addEventListener("popstate", (event) => {
      return this.popState();
    });
  }

  pushState(name, path, obj = {}) {
    console.info(`pushing state\nname=${name}\npath=${path}`);
    if ((history.state != null) && history.state.name !== name) {
      obj.name = name;
      return history.pushState(obj, "", path);
    }
  }

  popState() {
    var i, len, p, project, ref, ref1, s;
    if (history.state != null) {
      s = history.state.name.split(".");
      if ((ref = history.state.name) === "documentation" || ref === "about" || ref === "projects" || ref === "explore") {
        if (history.state.name === "projects") {
          if (this.app.project && this.app.project.pending_changes.length > 0) {
            history.forward();
            alert("Please wait while saving your changes...");
          } else {
            this.app.appui.backToProjectList();
          }
        }
        if (history.state.name === "explore") {
          this.app.explore.closeProject();
        }
        return this.app.appui.setMainSection((function(p) {
          return {
            "documentation": "help"
          }[p] || p;
        })(history.state.name));
      } else if (history.state.name === "home") {
        return this.app.appui.setMainSection("home");
      } else if (history.state.name.startsWith("project.") && (s[1] != null) && (s[2] != null)) {
        project = s[1];
        if ((this.app.project == null) || this.app.project.slug !== project) {
          if (this.app.projects) {
            ref1 = this.app.projects;
            for (i = 0, len = ref1.length; i < len; i++) {
              p = ref1[i];
              if (p.slug === project) {
                this.app.openProject(p, false);
                break;
              }
            }
          }
        }
        this.app.appui.setMainSection("projects");
        return this.app.appui.setSection(s[2]);
      } else if (history.state.name.startsWith("documentation")) {
        s = history.state.name.split(".");
        if (s[1]) {
          this.app.documentation.setSection(s[1]);
          return this.app.appui.setMainSection("help");
        } else {
          return this.app.appui.setMainSection("help");
        }
      } else if (history.state.name.startsWith("tutorials")) {
        s = history.state.name.split(".");
        if (s[1]) {
          this.app.tutorials.tutorials_page.setSection(s[1], false);
          this.app.appui.setMainSection("tutorials");
          if (s[1] === "examples") {
            if (s[2] && s[3]) {
              return this.app.tutorials.tutorials_page.reloadExample(s[2], s[3]);
            } else {
              return this.app.tutorials.tutorials_page.closeExampleView();
            }
          }
        } else {
          this.app.tutorials.tutorials_page.setSection("core");
          return this.app.appui.setMainSection("tutorials");
        }
      } else if (history.state.name.startsWith("user.") && (s[1] != null)) {
        switch (s[1]) {
          case "settings":
            this.app.appui.setMainSection("usersettings");
            return this.app.user_settings.setSection("settings");
          case "profile":
            this.app.appui.setMainSection("usersettings");
            return this.app.user_settings.setSection("profile");
          case "progress":
            this.app.appui.setMainSection("usersettings");
            return this.app.user_settings.setSection("progress");
        }
      } else if (history.state.name === "project_details") {
        if (history.state.project != null) {
          this.app.explore.openProject(history.state.project);
          return this.app.appui.setMainSection("explore");
        } else {
          s = location.pathname.split("/");
          if ((s[2] != null) && (s[3] != null)) {
            p = this.app.explore.findProject(s[2], s[3]);
            if (p) {
              this.app.explore.openProject(p);
              return this.app.appui.setMainSection("explore");
            }
          }
        }
      }
    }
  }

  stateInitialized() {
    console.info("state initialized");
    return this.app.documentation.stateInitialized();
  }

  initState() {
    var i, len, p, path, project, ref, s, tab;
    if (location.pathname.startsWith("/login/")) {
      path = this.app.translator.lang !== "en" ? `/${this.app.translator.lang}/` : "/";
      history.replaceState({
        name: "home"
      }, "", path);
      this.app.appui.setMainSection("home");
      this.app.appui.showLoginPanel();
    } else if (location.pathname.startsWith("/tutorial/")) {
      this.load_tutorial = true;
    } else if (location.pathname.startsWith("/i/")) {
      this.app.appui.setMainSection("explore", false);
      history.replaceState({
        name: "project_details"
      }, "", location.pathname);
    } else {
      ref = ["about", "tutorials", "explore", "documentation"];
      for (i = 0, len = ref.length; i < len; i++) {
        p = ref[i];
        if (location.pathname.startsWith(`/${p}/`) || location.pathname === `/${p}`) {
          history.replaceState({
            name: p
          }, "", location.pathname);
          if (p === "explore") {
            s = location.pathname.split("/")[2];
            if (s === "library" || s === "plugin" || s === "tutorial" || s === "app" || s === "all") {
              this.app.explore.setProjectType(s);
            }
          } else if (p === "documentation") {
            path = location.pathname.split("/");
            if (path[2]) {
              this.app.documentation.setSection(path[2], null, null, false);
            }
          } else if (p === "tutorials") {
            path = location.pathname.split("/");
            if (path[2]) {
              this.app.tutorials.tutorials_page.setSection(path[2], false);
              history.replaceState({
                name: `tutorials.${path[2]}`
              }, "", location.pathname);
              if (path[2] === "examples") {
                if (path[3] && path[4]) {
                  this.app.tutorials.tutorials_page.reloadExample(path[3], path[4]);
                  history.replaceState({
                    name: `tutorials.${path[2]}.${path[3]}.${path[4]}`
                  }, "", location.pathname);
                }
              }
            }
          }
          this.app.appui.setMainSection(((p) => {
            return {
              "documentation": "help"
            }[p] || p;
          })(p));
          this.stateInitialized();
          return;
        }
      }
      if (this.app.user != null) {
        s = location.pathname.split("/");
        if (location.pathname.startsWith("/projects/") && s[2] && s[3]) {
          project = s[2];
          tab = s[3];
          history.replaceState({
            name: `project.${s[2]}.${s[3]}`
          }, "", location.pathname);
        } else if (location.pathname.startsWith("/user/") && s[2]) {
          switch (s[2]) {
            case "settings":
              this.app.appui.setMainSection("usersettings");
              this.app.user_settings.setSection("settings");
              break;
            case "profile":
              this.app.appui.setMainSection("usersettings");
              this.app.user_settings.setSection("profile");
              break;
            case "progress":
              this.app.appui.setMainSection("usersettings");
              this.app.user_settings.setSection("progress");
          }
        } else {
          this.app.appui.setMainSection("projects");
          history.replaceState({
            name: "projects"
          }, "", "/projects/");
        }
      } else {
        path = this.app.translator.lang !== "en" ? `/${this.app.translator.lang}/` : "/";
        history.replaceState({
          name: "home"
        }, "", path);
        this.app.appui.setMainSection("home");
      }
    }
    return this.stateInitialized();
  }

  projectsFetched() {
    var path, project, tuto, user;
    if ((history.state != null) && (history.state.name != null)) {
      if (history.state.name.startsWith("project.")) {
        this.popState();
      }
    }
    if (this.load_tutorial) {
      delete this.load_tutorial;
      path = location.pathname.split("/");
      path.splice(0, 2);
      if (path[path.length - 1] === "") {
        path.splice(path.length - 1, 1);
      }
      path = path.join("/");
      path = location.origin + `/${path}/doc/doc.md?v=${Date.now()}`;
      console.info(path);
      tuto = new Tutorial(path, false);
      tuto.load(() => {
        return this.app.tutorial.start(tuto);
      }, (err) => {
        console.info(err);
        alert(this.app.translator.get("Tutorial not found"));
        return history.replaceState({
          name: "home"
        }, "", "/");
      });
      this.app.client.listen("project_file_updated", (msg) => {
        if (msg.type === "doc" && msg.file === "doc") {
          tuto.update(msg.data);
          return this.app.tutorial.update();
        }
      });
      user = location.pathname.split("/")[2];
      project = location.pathname.split("/")[3];
      return this.app.client.send({
        name: "listen_to_project",
        user: user,
        project: project
      });
    }
  }

};

this.Tutorials = class Tutorials {
  constructor(app) {
    this.app = app;
    this.tutorials_page = new TutorialsPage(this);
  }

  load() {
    var origin, req;
    req = new XMLHttpRequest();
    req.onreadystatechange = (event) => {
      if (req.readyState === XMLHttpRequest.DONE) {
        if (req.status === 200) {
          return this.update(req.responseText);
        }
      }
    };
    origin = window.ms_tutorials_root_url || location.origin + "/tutorials/";
    switch (this.app.translator.lang) {
      case "fr":
        req.open("GET", origin + "fr/toc.md");
        break;
      case "it":
        req.open("GET", origin + "it/toc.md");
        break;
      case "pt":
        req.open("GET", origin + "pt/toc.md");
        break;
      default:
        req.open("GET", origin + "en/toc.md");
    }
    return req.send();
  }

  update(doc) {
    var e, e2, element, j, k, len, len1, list, ref, ref1;
    element = document.createElement("div");
    element.innerHTML = DOMPurify.sanitize(marked(doc));
    this.tutorials = [];
    if (element.hasChildNodes()) {
      ref = element.childNodes;
      for (j = 0, len = ref.length; j < len; j++) {
        e = ref[j];
        //console.info e
        switch (e.tagName) {
          case "H2":
            list = {
              title: e.innerText,
              description: "",
              list: []
            };
            this.tutorials.push(list);
            break;
          case "P":
            if (e.hasChildNodes()) {
              ref1 = e.childNodes;
              for (k = 0, len1 = ref1.length; k < len1; k++) {
                e2 = ref1[k];
                switch (e2.tagName) {
                  case "A":
                    if (list != null) {
                      list.list.push({
                        title: e2.textContent,
                        link: e2.href
                      });
                    }
                    break;
                  case void 0:
                    list.description = e2.textContent;
                }
              }
            }
        }
      }
    }
    //console.info @tutorials
    this.build();
  }

  checkCompletion() {
    var all, course, hasAchievement, i, id, j, k, len, len1, list, progress, ref, ref1, results, tuto;
    list = ["tour", "programming", "drawing", "game"];
    ref = this.tutorials;
    results = [];
    for (i = j = 0, len = ref.length; j < len; i = ++j) {
      course = ref[i];
      all = true;
      ref1 = course.list;
      for (k = 0, len1 = ref1.length; k < len1; k++) {
        tuto = ref1[k];
        progress = this.app.getTutorialProgress(tuto.link);
        if (progress !== 100) {
          all = false;
        }
      }
      if (all) {
        id = `tutorials/tutorial_${list[i]}`;
        hasAchievement = (id) => {
          var a, l, len2, ref2;
          ref2 = this.app.user.info.achievements;
          for (l = 0, len2 = ref2.length; l < len2; l++) {
            a = ref2[l];
            if (a.id === id) {
              return true;
            }
          }
          return false;
        };
        if (!hasAchievement(id)) {
          console.info("sending tutorial completion " + id);
          results.push(this.app.client.send({
            name: "tutorial_completed",
            id: id
          }));
        } else {
          results.push(void 0);
        }
      } else {
        results.push(void 0);
      }
    }
    return results;
  }

  build() {
    var div, j, len, ref, t;
    document.getElementById("tutorials-content").innerHTML = "";
    ref = this.tutorials;
    for (j = 0, len = ref.length; j < len; j++) {
      t = ref[j];
      this.buildCourse(t);
    }
    this.checkCompletion();
    div = document.createElement("div");
    div.innerHTML = `<br/>\n<h1 style="margin-top:80px">${this.app.translator.get("More Tutorials")}</h1>\n<h3 style="margin-bottom: 0px;">${this.app.translator.get("Check this great series of microStudio tutorials by mrLman:")}</h3>\n<br/><a target="_blank" href="https://sites.google.com/ed.act.edu.au/games-programming/game-elements/"><img src="/img/mrlman_tutorials.png" /></a>`;
    document.getElementById("tutorials-content").appendChild(div);
  }

  buildCourse(course) {
    var div, h2, j, len, p, ref, t, ul;
    div = document.createElement("div");
    div.classList.add("course");
    h2 = document.createElement("h2");
    h2.innerText = course.title;
    div.appendChild(h2);
    p = document.createElement("p");
    div.appendChild(p);
    p.innerText = course.description;
    ul = document.createElement("ul");
    div.appendChild(ul);
    ref = course.list;
    for (j = 0, len = ref.length; j < len; j++) {
      t = ref[j];
      div.appendChild(this.buildTutorial(t));
    }
    return document.getElementById("tutorials-content").appendChild(div);
  }

  buildTutorial(t) {
    var a, code, li, progress;
    li = document.createElement("li");
    li.innerHTML = `<i class='fa fa-play'></i> ${t.title}`;
    li.addEventListener("click", () => {
      return this.startTutorial(t);
    });
    progress = this.app.getTutorialProgress(t.link);
    if (progress > 0) {
      li.style.background = `linear-gradient(90deg,hsl(160,50%,70%) 0%,hsl(160,50%,70%) ${progress}%,rgba(0,0,0,.1) ${progress}%)`;
      li.addEventListener("mouseover", function() {
        return li.style.background = "hsl(200,50%,70%)";
      });
      li.addEventListener("mouseout", function() {
        return li.style.background = `linear-gradient(90deg,hsl(160,50%,70%) 0%,hsl(160,50%,70%) ${progress}%,rgba(0,0,0,.1) ${progress}%)`;
      });
    }
    if (progress === 100) {
      li.firstChild.classList.remove("fa-play");
      li.firstChild.classList.add("fa-check");
    }
    a = document.createElement("a");
    a.href = t.link;
    a.target = "_blank";
    a.title = this.app.translator.get("View tutorial source code");
    code = document.createElement("i");
    code.classList.add("fas");
    code.classList.add("fa-file-code");
    a.appendChild(code);
    li.appendChild(a);
    a.addEventListener("click", (event) => {
      return event.stopPropagation();
    });
    return li;
  }

  startTutorial(t) {
    var tuto;
    tuto = new Tutorial(t.link.replace("https://microstudio.dev", location.origin));
    return tuto.load(() => {
      return this.app.tutorial.start(tuto);
    });
  }

};

this.Tutorial = (function() {
  function Tutorial(link, back_to_tutorials) {
    this.link = link;
    this.back_to_tutorials = back_to_tutorials != null ? back_to_tutorials : true;
    this.title = "";
  }

  Tutorial.prototype.load = function(callback, error) {
    var req;
    req = new XMLHttpRequest();
    req.onreadystatechange = (function(_this) {
      return function(event) {
        if (req.readyState === XMLHttpRequest.DONE) {
          if (req.status === 200) {
            return _this.update(req.responseText, callback);
          } else if (req.status >= 400) {
            if (error != null) {
              return error(req.status);
            }
          }
        }
      };
    })(this);
    req.open("GET", this.link);
    return req.send();
  };

  Tutorial.prototype.update = function(doc, callback) {
    var a, alist, button, e, element, i, j, len, len1, line, ref, s, step, text;
    element = document.createElement("div");
    element.innerHTML = DOMPurify.sanitize(marked(doc));
    this.steps = [];
    if (element.hasChildNodes()) {
      alist = element.getElementsByTagName("a");
      if (alist && alist.length > 0) {
        for (i = 0, len = alist.length; i < len; i++) {
          a = alist[i];
          a.target = "_blank";
        }
      }
      ref = element.childNodes;
      for (j = 0, len1 = ref.length; j < len1; j++) {
        e = ref[j];
        switch (e.tagName) {
          case "H1":
            this.title = e.innerText;
            break;
          case "H2":
            step = {
              title: e.innerText,
              content: []
            };
            this.steps.push(step);
            break;
          default:
            if (step != null) {
              if (e.tagName === "P" && e.textContent.startsWith(":")) {
                line = e.textContent;
                line = line.substring(1, line.length);
                s = line.split(" ");
                switch (s[0]) {
                  case "highlight":
                    s.splice(0, 1);
                    step.highlight = s.join(" ").trim();
                    break;
                  case "navigate":
                    s.splice(0, 1);
                    step.navigate = s.join(" ").trim();
                    break;
                  case "position":
                    s.splice(0, 1);
                    step.position = s.join(" ").trim();
                    break;
                  case "overlay":
                    step.overlay = true;
                    break;
                  case "auto":
                    s.splice(0, 1);
                    step.auto = s.join(" ").trim() || true;
                }
              } else {
                if (e.tagName === "PRE") {
                  text = e.firstChild.textContent;
                  button = document.createElement("div");
                  button.classList.add("copy-button");
                  button.innerText = app.translator.get("Copy");
                  e.appendChild(button);
                  (function(_this) {
                    return (function(text, button) {
                      return button.addEventListener("click", function() {
                        console.info(text);
                        navigator.clipboard.writeText(text);
                        button.innerText = app.translator.get("Copied!");
                        return button.classList.add("copied");
                      });
                    });
                  })(this)(text, button);
                }
                step.content.push(e);
              }
            } else if (e.tagName === "P" && e.textContent.startsWith(":")) {
              line = e.textContent;
              line = line.substring(1, line.length);
              s = line.split(" ");
              if (s.splice(0, 1)[0] === "project") {
                this.project_title = s.join(" ");
              }
            }
        }
      }
    }
    console.info(this.steps);
    if (callback != null) {
      return callback();
    }
  };

  return Tutorial;

})();

this.TutorialWindow = class TutorialWindow {
  constructor(app) {
    this.app = app;
    this.window = document.getElementById("tutorial-window");
    document.querySelector("#tutorial-window").addEventListener("mousedown", (event) => {
      return this.moveToFront();
    });
    document.querySelector("#tutorial-window .titlebar").addEventListener("click", (event) => {
      return this.uncollapse();
    });
    document.querySelector("#tutorial-window .titlebar").addEventListener("mousedown", (event) => {
      return this.startMove(event);
    });
    document.querySelector("#tutorial-window .navigation .resize").addEventListener("mousedown", (event) => {
      return this.startResize(event);
    });
    document.addEventListener("mousemove", (event) => {
      return this.mouseMove(event);
    });
    document.addEventListener("mouseup", (event) => {
      return this.mouseUp(event);
    });
    window.addEventListener("resize", () => {
      var b;
      b = this.window.getBoundingClientRect();
      return this.setPosition(b.x, b.y);
    });
    document.querySelector("#tutorial-window .navigation .previous").addEventListener("click", () => {
      return this.previousStep();
    });
    document.querySelector("#tutorial-window .navigation .next").addEventListener("click", () => {
      return this.nextStep();
    });
    document.querySelector("#tutorial-window .titlebar .minify").addEventListener("click", () => {
      return this.close();
    });
    this.highlighter = new Highlighter(this);
    this.max_ratio = .75;
  }

  moveToFront() {
    var e, i, len, list;
    list = document.getElementsByClassName("floating-window");
    for (i = 0, len = list.length; i < len; i++) {
      e = list[i];
      if (e.id === "tutorial-window") {
        e.style["z-index"] = 11;
      } else {
        e.style["z-index"] = 10;
      }
    }
  }

  start(tutorial) {
    var progress;
    this.tutorial = tutorial;
    this.shown = true;
    this.uncollapse();
    if ((this.tutorial.project_title != null) && (this.app.user == null)) {
      this.app.appui.accountRequired(() => {
        return this.start(this.tutorial);
      });
      return;
    }
    this.openProject();
    document.getElementById("tutorial-window").style.display = "block";
    document.querySelector("#tutorial-window .title").innerText = this.tutorial.title;
    progress = this.app.getTutorialProgress(this.tutorial.link);
    this.current_step = Math.round(progress / 100 * (this.tutorial.steps.length - 1));
    if (this.current_step === this.tutorial.steps.length - 1) {
      this.current_step = 0;
    }
    return this.setStep(this.current_step);
  }

  openProject() {
    var err, i, i1, i2, len, options, p, project, ref, slug;
    if (this.tutorial.project_title != null) {
      slug = RegexLib.slugify(this.tutorial.project_title.split("{")[0]);
      project = null;
      ref = this.app.projects;
      for (i = 0, len = ref.length; i < len; i++) {
        p = ref[i];
        if (p.slug === slug) {
          if ((this.app.project == null) || this.app.project.id !== p.id) {
            this.app.openProject(p);
          }
          project = p;
          break;
        }
      }
      if (project == null) {
        i1 = this.tutorial.project_title.indexOf("{");
        i2 = this.tutorial.project_title.lastIndexOf("}");
        if (i1 > 0 && i2 > i1) {
          options = {};
          try {
            options = JSON.parse(this.tutorial.project_title.substring(i1, i2 + 1));
          } catch (error) {
            err = error;
            console.error(err);
          }
          this.app.createProject(this.tutorial.project_title.substring(0, i1).trim(), slug, options, () => {
            return this.start(this.tutorial);
          });
          return;
        } else {
          this.app.createProject(this.tutorial.project_title, slug, () => {
            return this.start(this.tutorial);
          });
          return;
        }
      }
      this.app.setProjectTutorial(slug, this.tutorial.link);
      this.app.appui.setMainSection("projects");
      return this.app.appui.setSection("code");
    }
  }

  update() {
    if (this.tutorial != null) {
      return this.setStep(this.current_step);
    }
  }

  setStep(index) {
    var c, e, element, h, i, len, percent, progress, ref, s, step, w;
    if (this.tutorial != null) {
      index = Math.max(0, Math.min(this.tutorial.steps.length - 1, index));
      this.current_step = index;
      step = this.tutorial.steps[index];
      e = document.querySelector("#tutorial-window .content");
      e.innerHTML = "";
      ref = step.content;
      for (i = 0, len = ref.length; i < len; i++) {
        c = ref[i];
        e.appendChild(c);
      }
      e.scrollTo(0, 0);
      document.querySelector("#tutorial-window .navigation .step").innerText = (index + 1) + " / " + this.tutorial.steps.length;
      percent = Math.round(this.current_step / (this.tutorial.steps.length - 1) * 100);
      document.querySelector("#tutorial-window .navigation .step").style.background = `linear-gradient(90deg,hsl(200,50%,80%) 0%,hsl(200,50%,80%) ${percent}%,transparent ${percent}%)`;
      if (step.navigate != null) {
        s = step.navigate.split(".");
        this.app.appui.setMainSection(s[0]);
        if (s[1] != null) {
          this.app.appui.setSection(s[1]);
        }
        switch (s[2]) {
          case "console":
            this.app.appui.code_splitbar.setPosition(0);
            this.app.appui.runtime_splitbar.setPosition(0);
        }
      }
      if (step.position != null) {
        s = step.position.split(",");
        if (s.length === 4) {
          w = Math.floor(Math.max(200, Math.min(window.innerWidth * s[2] / 100)));
          h = Math.floor(Math.max(200, Math.min(window.innerHeight * s[3] / 100)));
          this.window.style.width = `${w}px`;
          this.window.style.height = `${h}px`;
          this.setPosition(s[0] * window.innerWidth / 100, s[1] * window.innerHeight / 100);
        }
      }
      if (step.highlight != null) {
        this.highlighter.highlight(step.highlight, step.auto === true);
      } else {
        this.highlighter.hide();
      }
      if ((step.auto != null) && step.auto !== true) {
        element = document.querySelector(step.auto);
        if (element != null) {
          this.highlighter.setAuto(element);
        }
      }
      if (step.overlay) {
        document.getElementById("tutorial-overlay").style.display = "block";
      } else {
        document.getElementById("tutorial-overlay").style.display = "none";
      }
    }
    //if @current_step>0
    progress = this.app.getTutorialProgress(this.tutorial.link);
    percent = Math.round(this.current_step / (this.tutorial.steps.length - 1) * 100);
    //if percent>progress
    this.app.setTutorialProgress(this.tutorial.link, percent);
    if (this.current_step === this.tutorial.steps.length - 1) {
      document.querySelector("#tutorial-window .navigation .next").classList.add("fa-check");
      document.querySelector("#tutorial-window .navigation .next").classList.remove("fa-arrow-right");
    } else {
      document.querySelector("#tutorial-window .navigation .next").classList.remove("fa-check");
      document.querySelector("#tutorial-window .navigation .next").classList.add("fa-arrow-right");
    }
  }

  nextStep() {
    if (this.current_step === this.tutorial.steps.length - 1) {
      return this.close();
    } else {
      return this.setStep(this.current_step + 1);
    }
  }

  previousStep() {
    return this.setStep(this.current_step - 1);
  }

  close() {
    var b, button;
    if (this.current_step === this.tutorial.steps.length - 1) {
      this.shown = false;
      if (this.tutorial.back_to_tutorials) {
        this.app.appui.setMainSection("tutorials");
      }
      document.getElementById("tutorial-window").style.display = "none";
      this.highlighter.hide();
      return document.getElementById("tutorial-overlay").style.display = "none";
    } else {
      this.highlighter.hide();
      document.getElementById("tutorial-overlay").style.display = "none";
      this.pos_top = this.window.style.top;
      this.pos_left = this.window.style.left;
      this.pos_width = this.window.style.width;
      this.pos_height = this.window.style.height;
      button = document.getElementById("menu-tutorials");
      b = button.getBoundingClientRect();
      this.window.classList.add("minimized");
      return setTimeout((() => {
        if (b.x < 0) { // Main bar is collapsed
          this.window.style.top = "20px";
          this.window.style.left = "240px";
        } else {
          this.window.style.top = Math.max(0, b.y + b.height - 10) + "px";
          this.window.style.left = Math.max(0, b.x + b.width / 2 + 20) + "px";
        }
        this.window.style.width = "30px";
        this.window.style.height = "30px";
        return this.collapsed = true;
      }), 100);
    }
  }

  uncollapse() {
    if (this.collapsed) {
      this.collapsed = false;
      this.openProject();
      this.window.style.top = this.pos_top;
      this.window.style.left = this.pos_left;
      this.window.style.width = this.pos_width;
      this.window.style.height = this.pos_height;
      return setTimeout((() => {
        this.window.classList.remove("minimized");
        return this.setStep(this.current_step);
      }), 100);
    }
  }

  startMove(event) {
    this.moving = true;
    this.drag_start_x = event.clientX;
    this.drag_start_y = event.clientY;
    this.drag_pos_x = this.window.getBoundingClientRect().x;
    return this.drag_pos_y = this.window.getBoundingClientRect().y;
  }

  startResize(event) {
    this.resizing = true;
    this.drag_start_x = event.clientX;
    this.drag_start_y = event.clientY;
    this.drag_size_w = this.window.getBoundingClientRect().width;
    return this.drag_size_h = this.window.getBoundingClientRect().height;
  }

  mouseMove(event) {
    var b, dx, dy, h, w;
    if (this.moving) {
      dx = event.clientX - this.drag_start_x;
      dy = event.clientY - this.drag_start_y;
      this.setPosition(this.drag_pos_x + dx, this.drag_pos_y + dy);
    }
    if (this.resizing) {
      dx = event.clientX - this.drag_start_x;
      dy = event.clientY - this.drag_start_y;
      w = Math.floor(Math.max(200, Math.min(window.innerWidth * this.max_ratio, this.drag_size_w + dx)));
      h = Math.floor(Math.max(200, Math.min(window.innerHeight * this.max_ratio, this.drag_size_h + dy)));
      this.window.style.width = `${w}px`;
      this.window.style.height = `${h}px`;
      b = this.window.getBoundingClientRect();
      if (w > window.innerWidth - b.x || h > window.innerHeight - b.y) {
        return this.setPosition(Math.min(b.x, window.innerWidth - w - 4), Math.min(b.y, window.innerHeight - h - 4));
      }
    }
  }

  mouseUp(event) {
    this.moving = false;
    return this.resizing = false;
  }

  setPosition(x, y) {
    var b;
    b = this.window.getBoundingClientRect();
    x = Math.max(4, Math.min(window.innerWidth - b.width - 4, x));
    y = Math.max(4, Math.min(window.innerHeight - b.height - 4, y));
    this.window.style.top = y + "px";
    return this.window.style.left = x + "px";
  }

};

this.Highlighter = class Highlighter {
  constructor(tutorial) {
    this.tutorial = tutorial;
    this.shown = false;
    this.canvas = document.getElementById("highlighter");
    this.arrow = document.getElementById("highlighter-arrow");
  }

  highlight(ref, auto) {
    var element, h, rect, w, x, y;
    if (ref != null) {
      element = document.querySelector(ref);
    }
    if (element != null) {
      // open main menu when it is collapsed
      if (ref.indexOf(".titlemenu") >= 0 && (document.getElementById("main-menu-button").offsetParent != null)) {
        element = document.getElementById("main-menu-button");
      }
      this.highlighted = element;
      rect = element.getBoundingClientRect();
      if (rect.width === 0) {
        this.hide();
        return;
      }
      x = rect.x + rect.width * .5;
      y = rect.y + rect.height * .5;
      w = Math.floor(rect.width * 1) + 40;
      h = Math.floor(rect.height * 1) + 40;
      this.canvas.width = w;
      this.canvas.height = h;
      this.canvas.style.width = `${w}px`;
      this.canvas.style.height = `${h}px`;
      this.canvas.style.top = `${Math.round(y - h / 2)}px`;
      this.canvas.style.left = `${Math.round(x - w / 2)}px`;
      this.canvas.style.display = "block";
      this.shown = true;
      this.updateCanvas();
      if (this.timeout != null) {
        clearTimeout(this.timeout);
      }
      this.timeout = setTimeout((() => {
        return this.justHide();
      }), 6000);
      if (auto) {
        return this.setAuto(element);
      } else {
        if (this.remove_event_listener != null) {
          return this.remove_event_listener();
        }
      }
    } else {
      return this.hide();
    }
  }

  setAuto(element) {
    var f;
    if (element.tagName === "INPUT" && element.type === "text") {
      f = (event) => {
        if (event.key === "Enter") {
          this.tutorial.nextStep();
          return element.removeEventListener("keydown", f);
        }
      };
      element.addEventListener("keydown", f);
      if (this.remove_event_listener != null) {
        this.remove_event_listener();
      }
      return this.remove_event_listener = () => {
        return element.removeEventListener("keydown", f);
      };
    } else {
      f = () => {
        this.tutorial.nextStep();
        return element.removeEventListener("click", f);
      };
      element.addEventListener("click", f);
      if (this.remove_event_listener != null) {
        this.remove_event_listener();
      }
      return this.remove_event_listener = () => {
        return element.removeEventListener("click", f);
      };
    }
  }

  hide() {
    this.shown = false;
    this.canvas.style.display = "none";
    if (this.remove_event_listener != null) {
      return this.remove_event_listener();
    }
  }

  justHide() {
    this.shown = false;
    return this.canvas.style.display = "none";
  }

  updateCanvas() {
    var amount, context, grd, h, i, j, ref1, w, x, y;
    if (!this.shown) {
      return;
    }
    requestAnimationFrame(() => {
      return this.updateCanvas();
    });
    context = this.canvas.getContext("2d");
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.highlighted.getBoundingClientRect().width === 0) {
      return;
    }
    context.shadowOpacity = 1;
    context.shadowBlur = 5;
    context.shadowColor = "#000";
    grd = context.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
    grd.addColorStop(0, "hsl(0,50%,60%)");
    grd.addColorStop(1, "hsl(60,50%,60%)");
    context.strokeStyle = "hsl(30,100%,70%)";
    context.lineWidth = 3;
    context.lineCap = "round";
    w = this.canvas.width / 2 - 5;
    h = this.canvas.height / 2 - 5;
    amount = (Date.now() % 1000) / 500;
    context.globalAlpha = Math.min(1, 2 - amount);
    amount = Math.min(1, amount);
    context.beginPath();
    context.moveTo(this.canvas.width / 2 + w, this.canvas.height / 2);
    for (i = j = 0, ref1 = amount; j <= ref1; i = j += .01) {
      x = Math.cos(i * 2 * Math.PI);
      y = Math.sin(i * 2 * Math.PI);
      x = x > 0 ? Math.sqrt(x) : -Math.sqrt(-x);
      y = y > 0 ? Math.sqrt(y) : -Math.sqrt(-y);
      context.lineTo(this.canvas.width / 2 + x * w, this.canvas.height / 2 + y * h);
    }
    //context.ellipse(@canvas.width/2,@canvas.height/2,w,h,Math.PI,Math.PI*2*Math.min(1,amount),0,true)
    return context.stroke();
  }

};

var TutorialsPage;

TutorialsPage = class TutorialsPage {
  constructor(tutorials) {
    this.tutorials = tutorials;
    this.app = this.tutorials.app;
    this.sections = ["core", "community", "examples"];
    this.initSections();
    this.setSection(this.sections[0], false);
    this.search = "";
    document.querySelector("#tutorials-example-view-topbar i").addEventListener("click", () => {
      this.closeExampleView();
      return this.pushState();
    });
    document.getElementById("example-search-input").addEventListener("input", () => {
      this.search = document.getElementById("example-search-input").value;
      return this.planExamplesUpdate();
    });
    document.querySelector("#tutorials-content-examples .project-search-bar select").addEventListener("change", () => {
      return this.planExamplesUpdate();
    });
  }

  planExamplesUpdate() {
    if (this.search_timeout != null) {
      clearTimeout(this.search_timeout);
    }
    this.search_timeout = setTimeout((() => {
      return this.queryExamples(0, (list) => {
        return this.displayExamples(list);
      });
    }), 1500);
    return document.querySelector("#tutorials-examples-list").style.opacity = .25;
  }

  initSections() {
    var j, len, ref, results, s;
    ref = this.sections;
    results = [];
    for (j = 0, len = ref.length; j < len; j++) {
      s = ref[j];
      results.push(((s) => {
        return document.getElementById(`tutorials-${s}`).addEventListener("click", () => {
          if (window.ms_standalone) {
            if (s === "community") {
              return window.open("https://microstudio.dev/tutorials/community/", "_blank");
            } else if (s === "examples") {
              return window.open("https://microstudio.dev/tutorials/examples/", "_blank");
            }
          } else {
            return this.setSection(s);
          }
        });
      })(s));
    }
    return results;
  }

  pushState() {
    if (this.current === "core") {
      return this.app.app_state.pushState("tutorials", "/tutorials/");
    } else {
      if (this.current === "examples" && (this.current_project != null)) {
        return this.app.app_state.pushState(`tutorials.${this.current}.${this.current_project.owner}.${this.current_project.slug}`, `/tutorials/${this.current}/${this.current_project.owner}/${this.current_project.slug}/`);
      } else {
        return this.app.app_state.pushState(`tutorials.${this.current}`, `/tutorials/${this.current}/`);
      }
    }
  }

  setSection(section, push_state = true) {
    var j, len, ref, s;
    console.info(section);
    this.current = section;
    if (push_state) {
      this.pushState();
    }
    ref = this.sections;
    for (j = 0, len = ref.length; j < len; j++) {
      s = ref[j];
      if (s === section) {
        document.getElementById(`tutorials-${s}`).classList.add("selected");
        document.getElementById(`tutorials-content-${s}`).style.display = "block";
      } else {
        document.getElementById(`tutorials-${s}`).classList.remove("selected");
        document.getElementById(`tutorials-content-${s}`).style.display = "none";
      }
    }
    if (section === "community") {
      return this.updateCommunity();
    } else if (section === "examples") {
      return this.updateExamples();
    }
  }

  queryExamples(offset = 0, callback, list = []) {
    var language;
    language = document.querySelector("#tutorials-content-examples .project-search-bar select").value.toLowerCase();
    return this.app.client.sendRequest({
      name: "get_public_projects",
      ranking: "hot",
      type: "example",
      language: language,
      tags: [],
      search: this.search.toLowerCase(),
      position: 0,
      offset: offset
    }, (msg) => {
      if (msg.list.length === 0) {
        if (callback != null) {
          return callback(list);
        }
      } else {
        list = list.concat(msg.list);
        return this.queryExamples(msg.offset, callback, list);
      }
    });
  }

  fetchAll(type, offset = 0, callback, list = []) {
    return this.app.client.sendRequest({
      name: "get_public_projects",
      ranking: "hot",
      type: type,
      tags: [],
      search: "", //@search.toLowerCase()
      position: 0,
      offset: offset
    }, (msg) => {
      if (msg.list.length === 0) {
        return callback(list);
      } else {
        list = list.concat(msg.list);
        return this.fetchAll(type, msg.offset, callback, list);
      }
    });
  }

  createProjectBox(p) {
    var div, i, icon, title;
    console.info(p);
    if (!p.flags.approved && !p.owner_info.approved && window.ms_project_moderation) {
      return null;
    }
    div = document.createElement("div");
    div.classList.add("launch-project-box");
    title = document.createElement("div");
    title.innerText = p.title;
    icon = new Image;
    if (p.icon) {
      icon.src = `${run_domain}/${p.owner}/${p.slug}/sprites/icon.png`;
    } else {
      icon.src = `${dev_domain}/img/lightbulb16.png`;
    }
    icon.classList.add("pixelated");
    div.appendChild(icon);
    i = document.createElement("i");
    i.classList.add("fa");
    i.classList.add("fa-play");
    div.appendChild(title);
    div.appendChild(i);
    return div;
  }

  updateCommunity() {
    var parent;
    parent = document.getElementById("tutorials-content-community");
    parent.innerHTML = "";
    return this.fetchAll("tutorial", 0, (list) => {
      var box, j, len, p, results;
      results = [];
      for (j = 0, len = list.length; j < len; j++) {
        p = list[j];
        box = this.createProjectBox(p);
        if (box) {
          parent.appendChild(box);
          results.push(((p) => {
            return box.addEventListener("click", () => {
              return window.open(dev_domain + `/tutorial/${p.owner}/${p.slug}/`, "_blank");
            });
          })(p));
        } else {
          results.push(void 0);
        }
      }
      return results;
    });
  }

  updateExamples() {
    return this.queryExamples(0, (list) => {
      return this.displayExamples(list);
    });
  }

  displayExamples(list) {
    var box, j, len, p, parent;
    parent = document.getElementById("tutorials-examples-list");
    parent.innerHTML = "";
    parent.style.opacity = 1;
    for (j = 0, len = list.length; j < len; j++) {
      p = list[j];
      box = this.createProjectBox(p);
      if (box) {
        parent.appendChild(box);
        ((p, box) => {
          return box.addEventListener("click", () => {
            this.current_project = {
              owner: p.owner,
              slug: p.slug
            };
            this.loadExample(p);
            this.openExampleView();
            return this.pushState();
          });
        })(p, box);
      }
    }
  }

  reloadExample(owner, slug) {
    return this.app.client.sendRequest({
      name: "get_public_project",
      owner: owner,
      project: slug
    }, (msg) => {
      var project;
      project = msg.project;
      if (project != null) {
        this.loadExample(project);
        this.openExampleView();
        return this.current_project = {
          owner: project.owner,
          slug: project.slug
        };
      }
    });
  }

  openExampleView() {
    document.getElementById("tutorials-examples-list").style.display = "none";
    document.querySelector("#tutorials-content-examples .project-search-bar").style.display = "none";
    document.getElementById("tutorials-examples-view").style.display = "block";
    return document.getElementById("tutorials-example-view-topbar").style.display = "block";
  }

  closeExampleView() {
    var device;
    document.getElementById("tutorials-examples-list").style.display = "block";
    document.querySelector("#tutorials-content-examples .project-search-bar").style.display = "block";
    document.getElementById("tutorials-examples-view").style.display = "none";
    document.getElementById("tutorials-example-view-topbar").style.display = "none";
    device = document.getElementById("tutorials-examples-run");
    device.innerHTML = "";
    return delete this.current_project;
  }

  loadExample(project) {
    var icon;
    delete this.selected_source;
    if (!this.examples_initialized) {
      this.examples_initialized = true;
      this.examples_splitbar = new SplitBar("tutorials-examples-view", "horizontal");
      this.examples_splitbar.auto = 1;
      this.examples_code_splitbar = new SplitBar("tutorials-examples-code", "horizontal");
      this.examples_code_splitbar.auto = .5;
      this.examples_code_splitbar.position = 20;
      this.examples_editor = ace.edit("tutorials-examples-code-editor");
      this.examples_editor.$blockScrolling = 2e308;
      this.examples_editor.setTheme("ace/theme/tomorrow_night_bright");
      this.examples_editor.getSession().setMode("ace/mode/microscript2");
      this.examples_editor.getSession().setOptions({
        tabSize: 2,
        useSoftTabs: true,
        useWorker: false // disables lua autocorrection ; preserves syntax coloring
      });
      this.examples_editor.getSession().on("change", () => {
        return this.codeEdited();
      });
    }
    if (project.icon) {
      icon = run_domain + `/${project.owner}/${project.slug}/sprites/icon.png`;
    } else {
      icon = `${dev_domain}/img/lightbulb16.png`;
    }
    document.querySelector("#tutorials-example-view-topbar img").src = icon;
    document.querySelector("#tutorials-example-view-topbar span").innerText = project.title;
    this.app.appui.createProjectLikesButton(document.getElementById("tutorials-example-view-topbar"), project);
    return this.app.client.sendRequest({
      name: "list_public_project_files",
      project: project.id,
      folder: "ms"
    }, (msg) => {
      var device, origin, url;
      this.setSourceList(msg.files, project);
      this.examples_splitbar.update();
      this.examples_code_splitbar.update();
      this.examples_splitbar.update();
      device = document.getElementById("tutorials-examples-run");
      origin = run_domain;
      url = `${run_domain}/${project.owner}/${project.slug}/`;
      device.innerHTML = `<iframe id='exampleiframe' allow='autoplay ${origin}; gamepad ${origin}; midi ${origin}; camera ${origin}; microphone ${origin}' src='${url}?debug'></iframe><i class='fas fa-redo'></i>`;
      return device.querySelector("i").addEventListener("click", () => {
        return this.postMessage({
          name: "command",
          line: "init()"
        });
      });
    });
  }

  setSelectedSource(file) {
    var lang, source;
    this.selected_source = file;
    this.source_folder.setSelectedItem(file);
    source = this.project_sources[file];
    if ((source != null) && (source.parent != null)) {
      source.parent.setOpen(true);
    }
    if ((this.project != null) && (this.project.language != null)) {
      lang = this.project.language;
      if (lang === "microscript_v2" && (this.sources[file] != null) && /^\s*\/\/\s*javascript\s*\n/.test(this.sources[file])) {
        lang = "javascript";
      }
      lang = this.app.languages[lang] || this.app.languages["microscript2"];
      this.examples_editor.getSession().setMode(lang.ace_mode);
    }
    return this.examples_editor.setValue(this.sources[file], -1);
  }

  setSourceList(files, project) {
    var f, folder, j, len, manager, s, table, view;
    table = {};
    manager = {
      folder: "ms",
      item: "source",
      openItem: (item) => {
        return this.setSelectedSource(item);
      }
    };
    this.project_sources = {};
    this.sources = {};
    project = JSON.parse(JSON.stringify(project)); // create a clone
    project.app = this.app;
    project.notifyListeners = (source) => {
      this.sources[source.name] = source.content;
      if (this.selected_source == null) {
        return this.setSelectedSource(source.name);
      }
    };
    project.getFullURL = function() {
      var url;
      return url = location.origin + `/${project.owner}/${project.slug}/`;
    };
    folder = new ProjectFolder(null, "source");
    for (j = 0, len = files.length; j < len; j++) {
      f = files[j];
      s = new ExploreProjectSource(project, f.file);
      this.project_sources[s.name] = s;
      folder.push(s);
      table[s.name] = s;
    }
    view = new FolderView(manager, document.querySelector("#tutorials-examples-code-files"));
    this.source_folder = view;
    view.editable = false;
    view.rebuildList(folder);
    this.project = project;
  }

  codeEdited() {
    if (this.selected_source) {
      return this.updateCode(this.selected_source + ".ms", this.examples_editor.getValue());
    }
  }

  updateCode(file, src) {
    return this.postMessage({
      name: "code_updated",
      file: file,
      code: src
    });
  }

  postMessage(data) {
    var iframe;
    iframe = document.getElementById("exampleiframe");
    if (iframe != null) {
      return iframe.contentWindow.postMessage(JSON.stringify(data), "*");
    }
  }

};

