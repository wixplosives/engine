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
      </html>
    `;
};
