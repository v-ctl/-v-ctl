import axios from 'axios'
import { getAuthToken } from 'src/utils/token'

const BASE_URL = window.location.origin
const webApiUri = '/api/v1/list/db/index.php'
const addDbApiUri = '/api/v1/add/db/index.php'
const optionalDbInfoUri = '/api/v1/add/db/index.php'
const dbInfoUri = '/api/v1/edit/db/index.php'
const updateDatabaseUri = '/api/v1/edit/db/index.php'

export const getDatabaseList = () => {
  return axios.get(BASE_URL + webApiUri)
}

export const bulkAction = (action, domainNameSystems) => {
  const formData = new FormData()
  formData.append('action', action)
  formData.append('token', getAuthToken())

  domainNameSystems.forEach((domainNameSystem) => {
    formData.append('database[]', domainNameSystem)
  })

  return axios.post(BASE_URL + '/api/v1/bulk/db/', formData)
}

export const handleAction = (uri) => {
  return axios.get(BASE_URL + uri, {
    params: {
      token: getAuthToken(),
    },
  })
}

export const getDbOptionalInfo = () => {
  return axios.get(BASE_URL + optionalDbInfoUri)
}

export const addDatabase = (data) => {
  let formDataObject = new FormData()

  for (let key in data) {
    formDataObject.append(key, data[key])
  }

  return axios.post(BASE_URL + addDbApiUri, formDataObject)
}

export const dbCharsets = [
  'big5',
  'dec8',
  'cp850',
  'hp8',
  'koi8r',
  'latin1',
  'latin2',
  'swe7',
  'ascii',
  'ujis',
  'sjis',
  'hebrew',
  'tis620',
  'euckr',
  'koi8u',
  'gb2312',
  'greek',
  'cp1250',
  'gbk',
  'latin5',
  'armscii8',
  'utf8',
  'utf8mb4',
  'ucs2',
  'cp866',
  'keybcs2',
  'macce',
  'macroman',
  'cp852',
  'latin7',
  'cp1251',
  'cp1256',
  'cp1257',
  'binary',
  'geostd8',
  'cp932',
  'eucjpms',
]

export const getDatabaseInfo = (database) => {
  return axios.get(BASE_URL + dbInfoUri, {
    params: {
      database,
      token: getAuthToken(),
    },
  })
}

export const updateDatabase = (data, database) => {
  let formDataObject = new FormData()

  for (let key in data) {
    formDataObject.append(key, data[key])
  }

  return axios.post(BASE_URL + updateDatabaseUri, formDataObject, {
    params: {
      database,
      token: getAuthToken(),
    },
  })
}
