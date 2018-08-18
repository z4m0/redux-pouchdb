import { equals } from 'ramda'
import saveArray, { isUpToDate } from './utils/saveArray'
import { equalsOmittingDocProps } from './utils/ramdaUtils'
import waitAvailability from './utils/waitAvailability'

export const UPDATE_ARRAY_REDUCER = '@@redux-pouchdb/UPDATE_ARRAY_REDUCER'

let isInitialized = {}

export const isArrayUpToDate = reducerName =>
  // console.log(isInitialized[reducerName], isUpToDate(reducerName)),
  isInitialized !== 'undefined' ||
  (isInitialized[reducerName] && isUpToDate(reducerName))

const updateArrayReducer = (store, doc, reducerName) => {
  // console.log('store.dispatch update array', JSON.stringify(doc, null, 2))
  store.dispatch({
    type: UPDATE_ARRAY_REDUCER,
    reducerName,
    doc
  })
}

const initializePersistentArrayReducer = async (
  storeGetter,
  db,
  reducerName,
  saveArrayReducer
) => {
  try {
    const store = await waitAvailability(storeGetter)

    // dispatch updates
    const res = await db.allDocs({ include_docs: true })
    await Promise.all(
      res.rows.map(row => updateArrayReducer(store, row.doc, reducerName))
    )

    db.changes({
      include_docs: true,
      live: true,
      since: 'now'
    }).on('change', change => {
      // console.log('change', change)
      if (change.doc) {
        // console.log('updateArrayReducer', change.doc)
        updateArrayReducer(store, change.doc, reducerName)
      } else {
        // console.log('saveArrayReducer', store.getState())
        saveArrayReducer(store.getState())
      }
    })
  } catch (err) {
    console.error(err)
  }

  isInitialized[reducerName] = true
}
// Higher order reducer
const persistentArrayReducer = (storeGetter, db, reducerName) => reducer => {
  let lastState
  isInitialized[reducerName] = false
  const saveArrayReducer = saveArray(db, reducerName)
  // console.log(storeGetter.toString())
  initializePersistentArrayReducer(
    storeGetter,
    db,
    reducerName,
    saveArrayReducer
  )

  return (state, action) => {
    // console.log('reducer', action.type, state)
    if (
      action.type === UPDATE_ARRAY_REDUCER &&
      action.reducerName === reducerName &&
      action.doc
    ) {
      // console.log('action', action)
      let found = false
      lastState = state.map(item => {
        if (
          equalsOmittingDocProps(item, action.doc) ||
          item._id === action.doc._id
        ) {
          found = true
          return action.doc
        }

        return item
      })
      if (!found) {
        lastState.push(action.doc)
      }

      return reducer(lastState, action)
    }

    const reducedState = reducer(state, action)

    const inited = isInitialized[reducerName]

    const init = async () => {
      const success = await waitAvailability(
        () => isInitialized[reducerName] && isArrayUpToDate(reducerName)
      )
      // console.log('inited', success)
      if (inited && success && !equals(reducedState, lastState)) {
        lastState = reducedState
        saveArrayReducer(reducedState)
      }
    }
    init()
    // console.log('lastState', lastState, 'reducedState', reducedState)

    return reducedState
  }
}

export default persistentArrayReducer
