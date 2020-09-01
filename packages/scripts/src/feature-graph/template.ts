// src/template.js

export default ({ body, title }: { body: string; title: string }) => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <link rel="stylesheet" href="/assets/index.css" />
        </head>
        
        <body>
          <div id="root">${body}</div>
        </body>
        
        <script src="/assets/bundle.js"></script>
      </html>
    `;
};
