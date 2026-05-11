import mongoose from 'mongoose';

if (!globalThis.__mongooseWarningPatchApplied) {
  globalThis.__mongooseWarningPatchApplied = true;
  const originalEmitWarning = process.emitWarning.bind(process);
  process.emitWarning = (warning, ...args) => {
    const text = typeof warning === 'string' ? warning : warning?.message || '';
    if (text.includes('Duplicate schema index on')) return;
    if (text.includes('`errors` is a reserved schema pathname')) return;
    return originalEmitWarning(warning, ...args);
  };
}

if (!globalThis.__mongooseIndexPatchApplied) {
  globalThis.__mongooseIndexPatchApplied = true;

  const originalSchemaIndex = mongoose.Schema.prototype.index;
  const originalSchemaIndexes = mongoose.Schema.prototype.indexes;

  const normalizeFields = (obj = {}) =>
    JSON.stringify(
      Object.keys(obj)
        .sort()
        .reduce((acc, key) => {
          acc[key] = obj[key];
          return acc;
        }, {})
    );

  const normalizeOptions = (obj = {}) => {
    const copy = { ...obj };
    delete copy.background;
    return JSON.stringify(
      Object.keys(copy)
        .sort()
        .reduce((acc, key) => {
          acc[key] = copy[key];
          return acc;
        }, {})
    );
  };

  mongoose.Schema.prototype.index = function patchedIndex(fields, options = {}) {
    try {
      const targetFields = normalizeFields(fields);
      const existingIndexes = this.indexes();
      const hasSameFields = existingIndexes.filter(([idxFields]) => normalizeFields(idxFields) === targetFields);

      if (
        hasSameFields.some(([_, idxOptions]) => normalizeOptions(idxOptions || {}) === normalizeOptions(options || {}))
      ) {
        return this;
      }

      for (const fieldName of Object.keys(fields || {})) {
        const path = this.path(fieldName);
        if (path?.options?.index === true) {
          delete path.options.index;
        }
      }
    } catch (_err) {
      // no-op
    }

    return originalSchemaIndex.call(this, fields, options);
  };

  mongoose.Schema.prototype.indexes = function patchedIndexes(...args) {
    const indexes = originalSchemaIndexes.call(this, ...args);
    const deduped = [];
    const seen = new Set();

    for (const [fields, options] of indexes) {
      const key = `${normalizeFields(fields)}|${normalizeOptions(options || {})}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push([fields, options]);
    }

    return deduped;
  };
}

