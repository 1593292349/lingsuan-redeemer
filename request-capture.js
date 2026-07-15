// Chrome webRequest classifies Fetch API calls as xmlhttprequest.
// "fetch" is not a valid value in WebRequestFilter.types.
export const REQUEST_TYPES = ['xmlhttprequest'];
