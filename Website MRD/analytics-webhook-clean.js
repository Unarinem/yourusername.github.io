function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    const spreadsheetId = '1xQD1FTEGQnIgk8ZvfWIPXQO3CsUf9uUPGn2xZ00LLc4';
    const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName('AnalyticsLog');
    
    const timestamp = new Date().toISOString();
    const eventType = data.event_type || data.type || 'page_view';
    const sessionId = data.session_id || '';
    const page = data.page || data.url || '';
    const userAgent = data.user_agent || '';
    const screenSize = data.screen_size || '';
    const referrer = data.referrer || '';
    const eventData = JSON.stringify(data.event_data || data);
    const notes = 'Analytics Log';
    const unixTimestamp = Date.now().toString();
    const timezone = 'Africa/Johannesburg';
    
    const rowData = [
      timestamp,
      eventType,
      sessionId,
      page,
      userAgent,
      screenSize,
      referrer,
      eventData,
      notes,
      unixTimestamp,
      timezone,
      '',
      '',
      '',
      '',
      ''
    ];
    
    sheet.appendRow(rowData);
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        message: 'Analytics data added successfully',
        timestamp: timestamp,
        rowAdded: sheet.getLastRow()
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        error: error.toString(),
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      message: 'MRD Analytics Webhook - CLEAN VERSION',
      timestamp: new Date().toISOString(),
      status: 'active'
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
