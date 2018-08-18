var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

import { equals, uniqWith, omit, concat, differenceWith } from 'ramda';

export const omitDocProps = omit(['_id', '_rev', '_deleted']);
export const equalsOmittingDocProps = (curr, old) => equals(omitDocProps(curr), omitDocProps(old));
export const uniqOmittingDocProps = uniqWith(equalsOmittingDocProps);
export const getDeletedItems = (curr, old) => differenceWith(equalsOmittingDocProps, old, curr);
export const getInsertedItems = differenceWith(equalsOmittingDocProps);
export const getDiff = (curr, old) => concat(getInsertedItems(curr, old), getDeletedItems(curr, old).map(x => _extends({}, x, {
  _deleted: true
})));