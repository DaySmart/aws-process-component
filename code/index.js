module.exports = async (e, ctx, cb) => {
  return { statusCode: 200, body: 'backend app deployed.' }
}

// you could also just return an object
// which would return it as body with
// 200 status code by default
// module.exports = () => ({ hello: 'world' })

// or just a string
// module.exports = () => 'success'

// or a status code number
// module.exports = () => 404 // not found!

// you don't even need to export a function!
// module.exports = { hello: 'world' } // great for mocking!
// module.exports = 'success'
// module.exports = 500