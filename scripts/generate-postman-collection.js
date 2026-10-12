/*
 * Builds EX_Backend_API.postman_collection.json from the backend's controllers.
 *
 *   node scripts/generate-postman-collection.js
 *
 * Read with the TypeScript compiler, not with regexes, so every route comes
 * with what it really takes: path variables, query parameters and the body —
 * from DTO classes, inline types and Prisma enums alike — with each field's
 * type, whether it is optional, its allowed values and its validators. Run it
 * again whenever a controller changes.
 *
 * Auth follows the app: a global guard wants a Bearer token on every route
 * except those marked @Public(), and @Roles([...]) narrows who may call one.
 * "Sign in" stores the token in the collection, so the other requests just work.
 */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const backendRoot = path.join(repoRoot, 'Backend');
const ts = require(path.join(backendRoot, 'node_modules', 'typescript'));
const outFile = path.join(repoRoot, 'EX_Backend_API.postman_collection.json');

const LIVE_URL = 'https://185.215.180.248.nip.io/api';
const LOCAL_URL = 'http://localhost:5000';
const TEAM_ROLES = new Set(['ADMIN', 'MONITER', 'STAFF']);
const HTTP = { Get: 'GET', Post: 'POST', Put: 'PUT', Patch: 'PATCH', Delete: 'DELETE', All: 'ALL' };

// ---------------------------------------------------------------- program

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (ent.isFile() && p.endsWith('.controller.ts')) out.push(p);
  }
  return out;
}

const config = ts.getParsedCommandLineOfConfigFile(path.join(backendRoot, 'tsconfig.json'), {}, {
  ...ts.sys,
  onUnRecoverableConfigFileDiagnostic: (d) => {
    throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n'));
  },
});
const controllerFiles = walk(path.join(backendRoot, 'src')).sort();
const program = ts.createProgram(controllerFiles, { ...config.options, noEmit: true, incremental: false });
const checker = program.getTypeChecker();

// ---------------------------------------------------------------- helpers

const decoratorsOf = (node) => (ts.canHaveDecorators(node) ? ts.getDecorators(node) || [] : []);

function decoratorInfo(dec) {
  const expr = dec.expression;
  if (ts.isCallExpression(expr)) {
    const callee = expr.expression;
    const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : '';
    return { name, args: expr.arguments };
  }
  if (ts.isIdentifier(expr)) return { name: expr.text, args: [] };
  return { name: '', args: [] };
}

function findDecorator(node, name) {
  return decoratorsOf(node).map(decoratorInfo).find((d) => d.name === name) || null;
}

/** A literal value from source: strings, numbers, arrays, and constants they name. */
function evaluate(node, depth = 0) {
  if (!node || depth > 5) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map((e) => evaluate(e, depth + 1));
  if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isSatisfiesExpression?.(node)) {
    return evaluate(node.expression, depth + 1);
  }
  if (ts.isSpreadElement(node)) return evaluate(node.expression, depth + 1);
  if (ts.isObjectLiteralExpression(node)) {
    const out = {};
    for (const p of node.properties) {
      if (ts.isPropertyAssignment(p) && p.name) out[p.name.getText()] = evaluate(p.initializer, depth + 1);
    }
    return out;
  }
  if (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node)) {
    let sym = checker.getSymbolAtLocation(node);
    if (sym && sym.flags & ts.SymbolFlags.Alias) sym = checker.getAliasedSymbol(sym);
    const decl = sym?.valueDeclaration;
    if (decl && ts.isVariableDeclaration(decl) && decl.initializer) return evaluate(decl.initializer, depth + 1);
    if (decl && ts.isEnumMember(decl)) return checker.getConstantValue(decl);
  }
  return undefined;
}

const flatten = (v) => (Array.isArray(v) ? v.flat(Infinity) : v);

function joinPath(...parts) {
  const joined = parts
    .filter((p) => p !== undefined && p !== null && p !== '')
    .map((p) => String(p).replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
  return '/' + joined;
}

function docOf(symbol) {
  if (!symbol) return '';
  const text = ts.displayPartsToString(symbol.getDocumentationComment(checker)).trim();
  return text.replace(/\s+/g, ' ');
}

function short(text, max = 220) {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
}

function humanize(name) {
  const words = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// ---------------------------------------------------------------- types → fields and samples

const SKIP_TYPES = /^(Request|Response|Express\.|IncomingMessage)/;

function literalValues(type) {
  const parts = type.isUnion() ? type.types : [type];
  const values = [];
  for (const t of parts) {
    if (t.flags & ts.TypeFlags.Undefined || t.flags & ts.TypeFlags.Null) continue;
    if (t.isStringLiteral() || t.isNumberLiteral()) values.push(t.value);
    else if (t.flags & ts.TypeFlags.BooleanLiteral) values.push(checker.typeToString(t) === 'true');
    else return null;
  }
  return values.length ? [...new Set(values)] : null;
}

function withoutNullish(type) {
  if (!type.isUnion()) return type;
  const rest = type.types.filter((t) => !(t.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null | ts.TypeFlags.Void)));
  if (rest.length === 1) return rest[0];
  return type;
}

function isNullable(type) {
  return type.isUnion() && type.types.some((t) => t.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null));
}

function sampleString(name) {
  const n = name.toLowerCase();
  if (n.includes('email')) return 'user@example.com';
  if (n.includes('password')) return 'Password123!';
  if (n.includes('phone')) return '+491511234567';
  if (/url|link|website|domain|image|pic|avatar/.test(n)) return 'https://example.com';
  if (/(^|_)date|_at$|at$|since|until|expires/.test(n) && !n.includes('status')) return '2026-01-01T00:00:00.000Z';
  if (/(^|[a-z])id$|_id$|^id$|ids?$/.test(n)) return '00000000-0000-0000-0000-000000000000';
  if (n.includes('otp') || n === 'code') return '123456';
  if (n.includes('zip') || n.includes('postal')) return '10115';
  if (n.includes('token')) return '<token>';
  return 'string';
}

/**
 * The type as a field description and a sample value.
 * Returns { type: 'string', values?, sample, children? }.
 */
function describeType(type, name, depth, seen) {
  type = withoutNullish(type);
  const typeText = checker.typeToString(type);
  const values = literalValues(type);
  // `boolean` is the union true | false to the checker; it is not an enum.
  if (values && values.every((v) => typeof v === 'boolean')) return { type: 'boolean', sample: false };
  if (values) return { type: values.every((v) => typeof v === 'string') ? 'enum' : typeof values[0], values, sample: values[0] };

  if (type.flags & ts.TypeFlags.StringLike) return { type: 'string', sample: sampleString(name) };
  if (type.flags & ts.TypeFlags.NumberLike) return { type: 'number', sample: /page/i.test(name) ? 1 : /limit|take|size/i.test(name) ? 20 : 0 };
  if (type.flags & ts.TypeFlags.BooleanLike) return { type: 'boolean', sample: false };
  if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return { type: 'any', sample: null };
  if (typeText === 'Date') return { type: 'date (ISO string)', sample: '2026-01-01T00:00:00.000Z' };
  if (/^Express\.Multer\.File|^File$/.test(typeText)) return { type: 'file', sample: null };

  if (checker.isArrayType(type) || checker.isTupleType(type)) {
    const elem = checker.getTypeArguments(type)[0];
    const inner = elem ? describeType(elem, name.replace(/s$/, ''), depth + 1, seen) : { type: 'any', sample: null };
    return { type: `${inner.type}[]`, values: inner.values, sample: inner.sample === undefined ? [] : [inner.sample], children: inner.children };
  }

  if (type.isUnion()) {
    const nullish = ts.TypeFlags.Undefined | ts.TypeFlags.Null | ts.TypeFlags.Void;
    const parts = type.types.filter((t) => !(t.flags & nullish)).map((t) => describeType(t, name, depth + 1, seen));
    const names = [...new Set(parts.map((p) => p.type))];
    return { type: names.join(' | '), sample: parts[0]?.sample ?? null, children: parts.find((p) => p.children)?.children };
  }

  if (type.flags & ts.TypeFlags.Object) {
    if (depth > 3 || seen.has(type)) return { type: 'object', sample: {} };
    const index = checker.getIndexInfosOfType(type)[0];
    const props = checker.getPropertiesOfType(type).filter((p) => !(p.flags & ts.SymbolFlags.Method));
    if (!props.length && index) {
      const inner = describeType(index.type, 'value', depth + 1, seen);
      return { type: `Record<string, ${inner.type}>`, sample: { key: inner.sample } };
    }
    const nextSeen = new Set(seen).add(type);
    const children = fieldsOf(type, depth + 1, nextSeen);
    const sample = {};
    for (const f of children) sample[f.name] = f.sample;
    return { type: 'object', sample, children };
  }
  return { type: typeText, sample: null };
}

const VALIDATOR_NAMES = /^(Is[A-Z]\w*|Min|Max|MinLength|MaxLength|Length|Matches|Equals|Contains|ArrayMinSize|ArrayMaxSize|ArrayNotEmpty|ValidateNested|Allow)$/;

function validatorsOf(decl) {
  const out = [];
  let optional = false;
  let enumValues = null;
  for (const d of decoratorsOf(decl).map(decoratorInfo)) {
    if (d.name === 'IsOptional' || d.name === 'ApiPropertyOptional') optional = true;
    if (d.name === 'IsEnum' && d.args[0]) {
      const t = checker.getTypeAtLocation(d.args[0]);
      const vals = checker
        .getPropertiesOfType(t)
        .map((p) => {
          const dd = p.valueDeclaration;
          return dd && ts.isEnumMember(dd) ? checker.getConstantValue(dd) : undefined;
        })
        .filter((v) => v !== undefined);
      const literal = flatten(evaluate(d.args[0]));
      enumValues = vals.length ? vals : Array.isArray(literal) ? literal : enumValues;
    }
    if (d.name === 'IsIn' && d.args[0]) {
      const v = flatten(evaluate(d.args[0]));
      if (Array.isArray(v)) enumValues = v;
    }
    if (VALIDATOR_NAMES.test(d.name) && d.name !== 'IsOptional') {
      const arg = d.args.length && ['Min', 'Max', 'MinLength', 'MaxLength', 'Length', 'ArrayMinSize', 'ArrayMaxSize'].includes(d.name)
        ? `(${d.args.map((a) => a.getText()).join(', ')})`
        : '';
      out.push(`${d.name}${arg}`);
    }
  }
  return { validators: out, optional, enumValues };
}

function fieldsOf(type, depth = 0, seen = new Set()) {
  const fields = [];
  for (const prop of checker.getPropertiesOfType(type)) {
    if (prop.flags & ts.SymbolFlags.Method) continue;
    const decl = prop.valueDeclaration || prop.declarations?.[0];
    const propType = checker.getTypeOfSymbolAtLocation(prop, decl || prop.declarations?.[0]);
    const v = decl ? validatorsOf(decl) : { validators: [], optional: false, enumValues: null };
    const info = describeType(propType, prop.name, depth, seen);
    const values = v.enumValues || info.values;
    const optional = Boolean(prop.flags & ts.SymbolFlags.Optional) || v.optional || isNullable(propType);
    fields.push({
      name: prop.name,
      type: values && info.type === 'string' ? 'enum' : info.type,
      optional,
      values,
      validators: v.validators,
      doc: docOf(prop),
      sample: values && info.sample === sampleString(prop.name) ? (info.type.endsWith('[]') ? [values[0]] : values[0]) : info.sample,
      children: info.children,
    });
    if (fields.length >= 60) break;
  }
  return fields;
}

/** The type a `new ZodValidationPipe(schema)` among the decorator's arguments validates into. */
function zodOutput(args) {
  for (const arg of args || []) {
    if (!ts.isNewExpression(arg) || arg.expression.getText() !== 'ZodValidationPipe' || !arg.arguments?.[0]) continue;
    const schemaType = checker.getTypeAtLocation(arg.arguments[0]);
    const output = schemaType.getProperty('_output');
    if (output) return checker.getTypeOfSymbolAtLocation(output, arg.arguments[0]);
  }
  return null;
}

/** `@ApiBody({ type: () => Dto })` or `@ApiBody({ type: Dto })`: the class it names. */
function apiBodyType(member) {
  const d = findDecorator(member, 'ApiBody');
  const obj = d?.args[0];
  if (!obj || !ts.isObjectLiteralExpression(obj)) return null;
  const prop = obj.properties.find((x) => ts.isPropertyAssignment(x) && x.name.getText() === 'type');
  if (!prop) return null;
  let target = prop.initializer;
  if (ts.isArrowFunction(target) && !ts.isBlock(target.body)) target = target.body;
  const t = checker.getTypeAtLocation(target);
  // A class reference is typed as its constructor; the body is an instance of it.
  const construct = t.getConstructSignatures()[0];
  return construct ? construct.getReturnType() : null;
}

const isAnyType = (t) => Boolean(t.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown));

// ---------------------------------------------------------------- controllers → routes

function routesOf(file) {
  const source = program.getSourceFile(file);
  const routes = [];
  source.forEachChild(function visit(node) {
    if (ts.isClassDeclaration(node) && findDecorator(node, 'Controller')) {
      const ctrl = findDecorator(node, 'Controller');
      let base = evaluate(ctrl.args[0]);
      if (base && typeof base === 'object' && !Array.isArray(base)) base = base.path;
      if (Array.isArray(base)) base = base[0];
      const classRoles = flatten(evaluate(findDecorator(node, 'Roles')?.args[0]));
      const classPublic = Boolean(findDecorator(node, 'Public'));
      const className = node.name?.text || 'Controller';

      for (const member of node.members) {
        if (!ts.isMethodDeclaration(member)) continue;
        const verb = decoratorsOf(member).map(decoratorInfo).find((d) => HTTP[d.name]);
        if (!verb) continue;
        let sub = evaluate(verb.args[0]);
        if (Array.isArray(sub)) sub = sub[0];
        const methodRoles = flatten(evaluate(findDecorator(member, 'Roles')?.args[0]));
        const roles = Array.isArray(methodRoles) ? methodRoles : Array.isArray(classRoles) ? classRoles : null;
        const isPublic = classPublic || Boolean(findDecorator(member, 'Public'));

        // Upload fields come from the interceptor: FileInterceptor('image'), FilesInterceptor('files', 4).
        const files = [];
        for (const d of decoratorsOf(member).map(decoratorInfo).filter((x) => x.name === 'UseInterceptors')) {
          for (const arg of d.args) {
            if (!ts.isCallExpression(arg)) continue;
            const fn = arg.expression.getText();
            const field = evaluate(arg.arguments[0]);
            if (fn === 'FileInterceptor' && typeof field === 'string') files.push({ name: field, multiple: false });
            if (fn === 'FilesInterceptor' && typeof field === 'string') files.push({ name: field, multiple: true, max: evaluate(arg.arguments[1]) });
            if (fn === 'FileFieldsInterceptor' && Array.isArray(field)) for (const f of field) files.push({ name: f?.name, multiple: (f?.maxCount ?? 1) > 1 });
            if (fn === 'AnyFilesInterceptor') files.push({ name: 'files', multiple: true });
          }
        }

        const pathParams = [];
        const query = [];
        const body = [];
        let bodyWhole = null;
        const headers = [];
        for (const param of member.parameters) {
          for (const d of decoratorsOf(param).map(decoratorInfo)) {
            const key = evaluate(d.args[0]);
            // What the value is validated into wins over how the parameter is typed:
            // `@Body(new ZodValidationPipe(schema)) body` declares no type at all.
            let type = zodOutput(d.args) || checker.getTypeAtLocation(param);
            if (d.name === 'Body' && typeof key !== 'string' && isAnyType(type)) type = apiBodyType(member) || type;
            const optional = Boolean(param.questionToken || param.initializer) || isNullable(type);
            if (d.name === 'Param') {
              if (typeof key === 'string') pathParams.push({ name: key, ...describeType(type, key, 0, new Set()) });
              else for (const f of fieldsOf(type)) pathParams.push(f);
            } else if (d.name === 'Query') {
              if (typeof key === 'string') {
                const info = describeType(type, key, 0, new Set());
                const v = validatorsOf(param);
                query.push({ name: key, type: info.type, values: info.values, sample: info.sample, optional: optional || v.optional || true, explicitOptional: optional, validators: v.validators });
              } else {
                for (const f of fieldsOf(type)) query.push({ ...f, explicitOptional: f.optional });
              }
            } else if (d.name === 'Body') {
              if (typeof key === 'string') {
                const info = describeType(type, key, 0, new Set());
                body.push({ name: key, ...info, optional, validators: [], doc: '' });
              } else if (!SKIP_TYPES.test(checker.typeToString(type))) {
                bodyWhole = describeType(type, 'body', 0, new Set());
                const typeName = checker.typeToString(type);
                bodyWhole.typeName = /^[A-Za-z_][\w.<>, ]*$/.test(typeName) && typeName.length < 60 && typeName !== 'any' ? typeName : '';
              }
            } else if (d.name === 'Headers' && typeof key === 'string') {
              headers.push(key);
            }
          }
        }

        // Path variables named in the route but never read through @Param() still exist.
        const fullPath = joinPath(base, sub);
        for (const m of fullPath.matchAll(/:([A-Za-z0-9_]+)/g)) {
          if (!pathParams.some((p) => p.name === m[1])) pathParams.push({ name: m[1], type: 'string', sample: null });
        }

        routes.push({
          file: path.relative(backendRoot, file).replace(/\\/g, '/'),
          line: source.getLineAndCharacterOfPosition(member.getStart()).line + 1,
          className,
          base: base || '',
          method: HTTP[verb.name],
          path: fullPath,
          handler: member.name.getText(),
          doc: docOf(member.name && checker.getSymbolAtLocation(member.name)),
          isPublic,
          roles,
          pathParams,
          query,
          body,
          bodyWhole,
          files,
          headers,
          // @Res({ passthrough: true }) still returns through Nest, so the envelope stays.
          usesRes: member.parameters.some((p) => {
            const res = findDecorator(p, 'Res') || findDecorator(p, 'Response');
            return res && evaluate(res.args[0])?.passthrough !== true;
          }),
        });
      }
    }
    ts.forEachChild(node, visit);
  });
  return routes;
}

// ---------------------------------------------------------------- Postman

function fieldLines(fields, indent = '') {
  const lines = [];
  for (const f of fields) {
    const bits = [`\`${f.type}\``, f.optional ? 'optional' : '**required**'];
    if (f.values?.length) bits.push(`one of: ${f.values.map((v) => `\`${v}\``).join(', ')}`);
    if (f.validators?.length) bits.push(f.validators.join(', '));
    lines.push(`${indent}- \`${f.name}\` — ${bits.join(' · ')}${f.doc ? ` — ${short(f.doc)}` : ''}`);
    if (f.children?.length && indent.length < 6) lines.push(...fieldLines(f.children, indent + '  '));
  }
  return lines;
}

function accessLine(r) {
  if (r.isPublic) return '**Access:** public — no token needed (a token, if sent, is read).';
  if (r.roles?.length) return `**Access:** Bearer token · roles: ${r.roles.join(', ')}`;
  return '**Access:** Bearer token · any signed-in user';
}

/**
 * Rules a handler enforces itself, which no decorator shows. Kept beside the
 * code they describe: user-update-access.ts, user-profile-view.ts and the
 * checks in chat.controller.ts.
 */
const ROUTE_NOTES = {
  'PATCH /user/:id':
    'Only your own account, unless you are an ADMIN. These fields are refused for everyone but an ADMIN: `role`, `permissions`, `verified`, `is_email_verified`, `is_phone_verified`, `email` (use /user/me/email/…), `password_hash`, `refresh_token`, `otp_code` (use /auth/change-password). The team edits other people with PATCH /user/update-by-admin/:id.',
  'GET /user/:id':
    'Your own account and the team see the whole record. Anyone else gets the public profile only: `id`, `first_name`, `last_name`, `business_name`, `profile_pic`, `role`, `verified`, `is_online`, `last_offline`, `last_seen`, `created_at`.',
  'GET /chat/create/:userId/:sellerId': 'You must be one of the two (`userId` or `sellerId`), unless you are on the team.',
};

function describe(r) {
  const parts = [];
  if (r.doc) parts.push(short(r.doc, 600));
  parts.push(`\`${r.method} ${r.path}\``);
  parts.push(accessLine(r));
  const note = ROUTE_NOTES[`${r.method} ${r.path}`];
  if (note) parts.push(`**Rule:** ${note}`);
  if (r.pathParams.length) parts.push('**Path variables**\n' + fieldLines(r.pathParams.map((p) => ({ ...p, optional: false }))).join('\n'));
  if (r.query.length) {
    parts.push(
      '**Query parameters**\n' +
        fieldLines(r.query.map((q) => ({ ...q, optional: q.explicitOptional !== false ? q.optional : false }))).join('\n'),
    );
  }
  if (r.files.length) {
    parts.push(
      '**Files (multipart/form-data)**\n' +
        r.files.map((f) => `- \`${f.name}\` — file${f.multiple ? `s (several${f.max ? `, up to ${f.max}` : ''})` : ''}`).join('\n'),
    );
  }
  const bodyFields = r.bodyWhole?.children || r.body;
  if (bodyFields.length) parts.push(`**Body${r.bodyWhole?.typeName ? ` (${r.bodyWhole.typeName})` : ''}**\n` + fieldLines(bodyFields).join('\n'));
  else if (r.bodyWhole && r.bodyWhole.type !== 'object') parts.push(`**Body:** \`${r.bodyWhole.type}\``);
  if (r.headers.length) parts.push(`**Headers read:** ${r.headers.map((h) => `\`${h}\``).join(', ')}`);
  if (r.usesRes) parts.push('_Writes its own response (not the usual `{status, data}` envelope)._');
  parts.push(`_Source: \`${r.file}:${r.line}\` (\`${r.className}.${r.handler}\`)_`);
  return parts.join('\n\n');
}

function bodySample(r) {
  if (r.bodyWhole) return r.bodyWhole.sample ?? {};
  if (!r.body.length) return null;
  const out = {};
  for (const f of r.body) out[f.name] = f.sample;
  return out;
}

function toItem(r, pathVarNames) {
  const segments = r.path.split('/').filter(Boolean);
  const request = {
    method: r.method === 'ALL' ? 'GET' : r.method,
    header: [],
    description: describe(r),
    url: {
      raw: '{{baseUrl}}' + r.path + (r.query.length ? '?' + r.query.map((q) => `${q.name}=`).join('&') : ''),
      host: ['{{baseUrl}}'],
      path: segments,
      ...(r.query.length
        ? {
            query: r.query.map((q) => ({
              key: q.name,
              value: q.sample === null || q.sample === undefined ? '' : String(Array.isArray(q.sample) ? q.sample[0] : q.sample),
              description: [q.type, q.values?.length ? `one of: ${q.values.join(', ')}` : '', q.doc || ''].filter(Boolean).join(' · '),
              disabled: q.explicitOptional !== false,
            })),
          }
        : {}),
      ...(r.pathParams.length
        ? {
            variable: r.pathParams.map((p) => {
              pathVarNames.add(p.name);
              return { key: p.name, value: `{{${p.name}}}`, description: p.type };
            }),
          }
        : {}),
    },
  };
  if (r.isPublic) request.auth = { type: 'noauth' };

  if (r.files.length) {
    const form = r.files.map((f) => ({ key: f.name, type: 'file', src: [], description: f.multiple ? 'several files allowed' : 'one file' }));
    const fields = r.bodyWhole?.children || r.body;
    for (const f of fields) {
      form.push({ key: f.name, value: typeof f.sample === 'object' ? JSON.stringify(f.sample) : String(f.sample ?? ''), type: 'text', description: f.optional ? 'optional' : 'required' });
    }
    request.body = { mode: 'formdata', formdata: form };
  } else {
    const sample = bodySample(r);
    if (sample !== null && !['GET', 'DELETE'].includes(request.method) || (sample && Object.keys(sample).length)) {
      request.header.push({ key: 'Content-Type', value: 'application/json' });
      request.body = { mode: 'raw', raw: JSON.stringify(sample ?? {}, null, 2), options: { raw: { language: 'json' } } };
    }
  }

  const item = { name: `${humanize(r.handler)}`, request };
  if (r.path === '/auth/signin' && r.method === 'POST') {
    item.event = [
      {
        listen: 'test',
        script: {
          type: 'text/javascript',
          exec: [
            '// Keep the tokens for every other request in this collection.',
            "// (A block, and no name like `data`: Postman's sandbox already defines it.)",
            '{',
            '  const signinJson = pm.response.json();',
            '  const signinBody = signinJson && signinJson.data && (signinJson.data.data || signinJson.data);',
            '  const signinTokens = (signinBody && signinBody.tokens) || (signinJson && signinJson.tokens) || {};',
            '  if (signinTokens.accessToken) {',
            "    pm.collectionVariables.set('token', signinTokens.accessToken);",
            "    pm.collectionVariables.set('refreshToken', signinTokens.refreshToken || '');",
            "    console.log('Signed in; token saved to the collection.');",
            '  } else {',
            "    console.warn('No token in the response: check the email and password.');",
            '  }',
            '}',
          ],
        },
      },
    ];
  }
  return item;
}

function folderName(r) {
  const base = String(r.base || '').replace(/^\/+/, '');
  const fromClass = r.className.replace(/Controller$/, '').replace(/([a-z])([A-Z])/g, '$1 $2');
  return base ? `${fromClass} (/${base})` : fromClass;
}

const isTeamOnly = (r) => !r.isPublic && Array.isArray(r.roles) && r.roles.length > 0 && r.roles.every((x) => TEAM_ROLES.has(x));

function build() {
  const routes = controllerFiles.flatMap(routesOf);
  const pathVarNames = new Set();
  const folders = new Map();
  for (const r of routes) {
    const name = folderName(r);
    if (!folders.has(name)) folders.set(name, { members: [], team: [] });
    (isTeamOnly(r) ? folders.get(name).team : folders.get(name).members).push(r);
  }

  const items = [...folders.entries()]
    .sort(([a], [b]) => (a.startsWith('Auth') ? -1 : b.startsWith('Auth') ? 1 : a.localeCompare(b)))
    .map(([name, group]) => {
      const children = group.members.map((r) => toItem(r, pathVarNames));
      if (group.team.length) {
        children.push({
          name: 'Team only (Admin / Moniter / Staff)',
          description: 'Routes no seller or buyer can call: every role allowed here is a team role.',
          item: group.team.map((r) => toItem(r, pathVarNames)),
        });
      }
      return { name, item: children };
    });

  const counts = {
    total: routes.length,
    public: routes.filter((r) => r.isPublic).length,
    team: routes.filter(isTeamOnly).length,
    withBody: routes.filter((r) => r.bodyWhole || r.body.length || r.files.length).length,
  };

  const collection = {
    info: {
      name: 'EX Backend API',
      _postman_id: 'ex-backend-api',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      description: [
        `Every route of the ExBuySell backend (${counts.total} in total; ${counts.public} public, ${counts.team} for the team only), generated from the controllers by \`scripts/generate-postman-collection.js\` on ${new Date().toISOString().slice(0, 10)}.`,
        '',
        '**Start here**',
        '1. Pick the server: the collection variable `baseUrl` is `{{liveUrl}}` (the live site). Set it to `{{localUrl}}` for a backend on your machine.',
        '2. Run **Auth → Signin** with a real email and password. The token is saved to `token` and every other request sends it.',
        '3. Path variables (`:id`, `:listingId`, …) read collection variables of the same name; fill them in once under the collection’s Variables.',
        '',
        '**Every response** comes wrapped by the server: `{ "status": "success", "timestamp": "…", "path": "…", "data": <the result> }`. Errors: `{ "status": "error", "statusCode": 4xx/5xx, "message": "…" }`. File downloads and routes marked “writes its own response” are not wrapped.',
        '',
        '**Access** is stated on each request: public, any signed-in user, or a list of roles (`USER`, `SELLER`, `ADMIN`, `MONITER`, `STAFF`). Team-only routes sit in a “Team only” folder inside their module.',
        '',
        '**Parameters**: each request’s description lists its path variables, query parameters and body fields with type, required/optional, allowed values and validators. Optional query parameters are added but switched off — tick them to send. Sample bodies are placeholders; replace them with real values.',
        '',
        '**Careful on live:** it runs on the same database the client uses. POST/PUT/PATCH/DELETE requests change real data, and the Stripe routes use Stripe test mode.',
      ].join('\n'),
    },
    auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] },
    variable: [
      { key: 'baseUrl', value: '{{liveUrl}}' },
      { key: 'liveUrl', value: LIVE_URL },
      { key: 'localUrl', value: LOCAL_URL },
      { key: 'token', value: '' },
      { key: 'refreshToken', value: '' },
      ...[...pathVarNames].sort().map((key) => ({ key, value: '' })),
    ],
    item: items,
  };
  fs.writeFileSync(outFile, JSON.stringify(collection, null, 2) + '\n');
  return { counts, folders: items.length, pathVars: pathVarNames.size, routes };
}

const result = build();
console.log(
  `Wrote ${path.relative(repoRoot, outFile)}: ${result.counts.total} requests in ${result.folders} folders ` +
    `(${result.counts.public} public, ${result.counts.team} team-only, ${result.counts.withBody} with a body), ` +
    `${result.pathVars} path variables.`,
);
if (process.argv.includes('--list')) {
  for (const r of result.routes) console.log(`${r.method.padEnd(6)} ${r.path}`);
}
