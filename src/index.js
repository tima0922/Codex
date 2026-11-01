export default {
  async fetch(request) {
    return new Response('Telegram bot hosting is ready 🚀', {
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  },
};
