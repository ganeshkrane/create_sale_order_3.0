import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';
import {fileURLToPath} from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIME_MAP: Record<string, string> = {
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.properties': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.pdf': 'application/pdf',
};

const storedUploads: any[] = [];
const storedDocViews: any[] = [];

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'ui5-odata-and-static-middleware',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const rawUrl = req.url || '';

            // Handle ZECC_ARTICLELIST_SRV_01 OData service endpoints
            if (rawUrl.includes('/sap/opu/odata/sap/ZECC_ARTICLELIST_SRV_01')) {
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
              res.setHeader('Access-Control-Allow-Headers', '*');
              res.setHeader('DataServiceVersion', '2.0');

              if (req.method === 'OPTIONS') {
                res.statusCode = 200;
                return res.end();
              }

              // Metadata request
              if (rawUrl.includes('/$metadata')) {
                res.setHeader('Content-Type', 'application/xml; charset=utf-8');
                const metaCandidates = [
                  path.resolve(__dirname, 'webapp/localService/ZECC_ARTICLELIST_SRV_01/ARTICLELIST_metadata.xml'),
                  path.resolve(__dirname, 'webapp/localService/ARTICLELIST_metadata.xml'),
                  path.resolve(__dirname, 'public/assets/aistudio/ARTICLELIST_metadata_d9e8707d.xml')
                ];
                for (const p of metaCandidates) {
                  if (fs.existsSync(p)) {
                    return res.end(fs.readFileSync(p, 'utf-8'));
                  }
                }
                return res.end('<edmx:Edmx xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx" Version="1.0"><edmx:DataServices m:DataServiceVersion="2.0"></edmx:DataServices></edmx:Edmx>');
              }

              // ArticelListSet query
              if (rawUrl.includes('ArticelListSet')) {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                const mockArticlesPath = path.resolve(__dirname, 'webapp/model/mockdata/articleList.json');
                let articles = [];
                if (fs.existsSync(mockArticlesPath)) {
                  try {
                    articles = JSON.parse(fs.readFileSync(mockArticlesPath, 'utf-8'));
                  } catch (e) {
                    articles = [];
                  }
                }

                // Parse search or filter query
                const urlObj = new URL(rawUrl, 'http://localhost:3000');
                const filter = decodeURIComponent(urlObj.searchParams.get('$filter') || '');
                const searchMatch = filter.match(/search eq '([^']+)'/i);
                const searchTerm = searchMatch ? searchMatch[1].trim().toLowerCase() : '';

                let filtered = articles;
                if (searchTerm) {
                  filtered = articles.filter((art: any) => {
                    const desc = (art.description || '').toLowerCase();
                    const num = (art.articleNumber || '').toLowerCase();
                    const cat = (art.category || '').toLowerCase();
                    const s = (art.search || '').toLowerCase();
                    return desc.includes(searchTerm) || num.includes(searchTerm) || cat.includes(searchTerm) || s.includes(searchTerm);
                  });
                }

                return res.end(JSON.stringify({
                  d: {
                    results: filtered
                  }
                }));
              }

              // ItemCategorySet query
              if (rawUrl.includes('ItemCategorySet')) {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                const urlObj = new URL(rawUrl, 'http://localhost:3000');
                const filter = decodeURIComponent(urlObj.searchParams.get('$filter') || '');
                const artMatch = filter.match(/articleNumber eq '([^']+)'/i);
                const siteMatch = filter.match(/site eq '([^']+)'/i);
                const prdMatch = filter.match(/prd eq '([^']+)'/i);

                const artNum = artMatch ? artMatch[1] : '';
                const site = siteMatch ? siteMatch[1] : 'M001';
                const prd = prdMatch ? prdMatch[1] : 'ZOR';

                const categories = [
                  {
                    __metadata: { type: 'ZECC_ARTICLELIST_SRV_01.ItemCategory' },
                    articleNumber: artNum,
                    site: site,
                    prd: prd,
                    pstyv: 'TAN',
                    text: 'Standard Item'
                  },
                  {
                    __metadata: { type: 'ZECC_ARTICLELIST_SRV_01.ItemCategory' },
                    articleNumber: artNum,
                    site: site,
                    prd: prd,
                    pstyv: 'TAC',
                    text: 'Cash / Carry Item'
                  },
                  {
                    __metadata: { type: 'ZECC_ARTICLELIST_SRV_01.ItemCategory' },
                    articleNumber: artNum,
                    site: site,
                    prd: prd,
                    pstyv: 'ZLNN',
                    text: 'Layby Item'
                  }
                ];

                return res.end(JSON.stringify({
                  d: {
                    results: categories
                  }
                }));
              }

              // TvLicenseSet query
              if (rawUrl.includes('TvLicenseSet')) {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                const isSingle = rawUrl.includes('TvLicenseSet(');
                const payload = {
                  __metadata: { type: 'ZECC_ARTICLELIST_SRV_01.TvLicense' },
                  salesOrderType: 'ZOR',
                  tvLicenseType: '04',
                  siteCode: 'M001',
                  artNumber: 'TV-LIC-01',
                  description: 'SABC TV License Validation / Annual Fee',
                  nettPrice: '265.00',
                  ItemCatagory: 'TAX'
                };
                return res.end(JSON.stringify({
                  d: isSingle ? payload : { results: [payload] }
                }));
              }

              // PriceOverideSet query
              if (rawUrl.includes('PriceOverideSet')) {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                let sUserId = 'MANAGER01';
                const keyMatch = rawUrl.match(/PriceOverideSet\((?:userId=)?'([^']+)'\)/i);
                if (keyMatch) {
                  sUserId = decodeURIComponent(keyMatch[1]);
                } else {
                  const filterMatch = rawUrl.match(/userId\s+eq\s+'([^']+)'/i);
                  if (filterMatch) {
                    sUserId = decodeURIComponent(filterMatch[1]);
                  }
                }
                const isUnauthorized = /unauth|noauth|reject|denied|invalid/i.test(sUserId) || sUserId.trim() === '';
                const sAuthorized = isUnauthorized ? 'N' : 'Y';
                const entity = {
                  __metadata: {
                    id: `http://localhost:3000/sap/opu/odata/sap/ZCRM_ORIGINATIONS_SRV/PriceOverideSet('${sUserId}')`,
                    uri: `http://localhost:3000/sap/opu/odata/sap/ZCRM_ORIGINATIONS_SRV/PriceOverideSet('${sUserId}')`,
                    type: 'ZCRM_ORIGINATIONS_SRV.PriceOveride'
                  },
                  userId: sUserId,
                  authorized: sAuthorized
                };
                const isSingle = rawUrl.includes('PriceOverideSet(');
                return res.end(JSON.stringify({
                  d: isSingle ? entity : { results: [entity] }
                }));
              }

              // Fallback for ZECC_ARTICLELIST_SRV_01 root
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              return res.end(JSON.stringify({
                d: {
                  EntitySets: ['ItemCategorySet', 'ArticelListSet', 'TvLicenseSet']
                }
              }));
            }

            // Handle ZCRM_ORIGINATIONS_SRV OData service endpoints
            if (rawUrl.includes('/sap/opu/odata/sap/ZCRM_ORIGINATIONS_SRV')) {
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
              res.setHeader('Access-Control-Allow-Headers', '*');
              res.setHeader('DataServiceVersion', '2.0');

              if (req.method === 'OPTIONS') {
                res.statusCode = 200;
                return res.end();
              }

              // Metadata request
              if (rawUrl.includes('/$metadata')) {
                res.setHeader('Content-Type', 'application/xml; charset=utf-8');
                const metaCandidates = [
                  path.resolve(__dirname, 'webapp/localService/ZCRM_ORIGINATIONS_SRV/metadata.xml'),
                  path.resolve(__dirname, 'webapp/localService/ZCRM_ORIGINATIONS_metadata.xml'),
                  path.resolve(__dirname, 'public/assets/aistudio/ZCRM_ORIGINATION.xml')
                ];
                for (const p of metaCandidates) {
                  if (fs.existsSync(p)) {
                    return res.end(fs.readFileSync(p, 'utf-8'));
                  }
                }
                return res.end('<edmx:Edmx xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx" Version="1.0"><edmx:DataServices m:DataServiceVersion="2.0"></edmx:DataServices></edmx:Edmx>');
              }

              // PriceOverideSet query
              if (rawUrl.includes('PriceOverideSet')) {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                let sUserId = 'MANAGER01';
                const keyMatch = rawUrl.match(/PriceOverideSet\((?:userId=)?'([^']+)'\)/i);
                if (keyMatch) {
                  sUserId = decodeURIComponent(keyMatch[1]);
                } else {
                  const filterMatch = rawUrl.match(/userId\s+eq\s+'([^']+)'/i);
                  if (filterMatch) {
                    sUserId = decodeURIComponent(filterMatch[1]);
                  }
                }
                const isUnauthorized = /unauth|noauth|reject|denied|invalid/i.test(sUserId) || sUserId.trim() === '';
                const sAuthorized = isUnauthorized ? 'N' : 'Y';
                const entity = {
                  __metadata: {
                    id: `http://localhost:3000/sap/opu/odata/sap/ZCRM_ORIGINATIONS_SRV/PriceOverideSet('${sUserId}')`,
                    uri: `http://localhost:3000/sap/opu/odata/sap/ZCRM_ORIGINATIONS_SRV/PriceOverideSet('${sUserId}')`,
                    type: 'ZCRM_ORIGINATIONS_SRV.PriceOveride'
                  },
                  userId: sUserId,
                  authorized: sAuthorized
                };
                const isSingle = rawUrl.includes('PriceOverideSet(');
                return res.end(JSON.stringify({
                  d: isSingle ? entity : { results: [entity] }
                }));
              }

              // QuickAppSet create (POST) and query (GET) for new customer creation
              if (rawUrl.includes('QuickAppSet')) {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                if (req.method === 'POST') {
                  let body = '';
                  req.on('data', chunk => { body += chunk; });
                  req.on('end', () => {
                    let parsed: any = {};
                    try {
                      parsed = JSON.parse(body);
                    } catch (e) {
                      parsed = {};
                    }
                    const sGeneratedBp = '10002' + Math.floor(10000 + Math.random() * 90000);
                    const sUserId = parsed.userId || 'STOREUSER';
                    const sCustomerName = parsed.customerName || (parsed.fName ? `${parsed.fName} ${parsed.sName || ''}`.trim() : (parsed.coName || 'New Customer'));

                    const quickAppRecord = {
                      __metadata: {
                        id: `http://localhost:3000/sap/opu/odata/sap/ZCRM_ORIGINATIONS_SRV/QuickAppSet('${sUserId}')`,
                        uri: `http://localhost:3000/sap/opu/odata/sap/ZCRM_ORIGINATIONS_SRV/QuickAppSet('${sUserId}')`,
                        type: 'ZCRM_ORIGINATIONS_SRV.QuickApp'
                      },
                      userId: sUserId,
                      bpId: sGeneratedBp,
                      customerName: sCustomerName,
                      fName: parsed.fName || '',
                      sName: parsed.sName || '',
                      title: parsed.title || 'Mr.',
                      inits: parsed.inits || (parsed.fName ? parsed.fName.charAt(0) : 'T'),
                      idType: parsed.idType || 'SA ID Number',
                      idNo: parsed.idNo || '',
                      dob: parsed.dob || '',
                      gender: parsed.gender || 'Male',
                      cellPhone: parsed.cellPhone || '',
                      homePhone: parsed.homePhone || parsed.cellPhone || '',
                      eMail: parsed.eMail || '',
                      entityType: parsed.entityType || 'Individual',
                      coName: parsed.coName || '',
                      coRegNumber: parsed.coRegNumber || '',
                      coBpId: parsed.entityType === 'Company' ? sGeneratedBp : '',
                      vatNumber: parsed.vatNumber || '',
                      dwellingType: parsed.dwellingType || 'HOUSE',
                      homeStreeName: parsed.homeStreeName || '',
                      homeSuburb: parsed.homeSuburb || '',
                      homeCity: parsed.homeCity || '',
                      homePostalCode: parsed.homePostalCode || '',
                      homeProvince: parsed.homeProvince || '',
                      homeCountry: parsed.homeCountry || 'ZA',
                      homeLatitude: parsed.homeLatitude || '-26.1076',
                      homeLongitude: parsed.homeLongitude || '28.0567',
                      delStreeName: parsed.delStreeName || parsed.homeStreeName || '',
                      delSuburb: parsed.delSuburb || parsed.homeSuburb || '',
                      delCity: parsed.delCity || parsed.homeCity || '',
                      delPostalCode: parsed.delPostalCode || parsed.homePostalCode || '',
                      delProvince: parsed.delProvince || parsed.homeProvince || '',
                      delCountry: parsed.delCountry || 'ZA',
                      delLatitude: parsed.delLatitude || parsed.homeLatitude || '-26.1076',
                      delLongitude: parsed.delLongitude || parsed.homeLongitude || '28.0567',
                      delSameAsRes: parsed.delSameAsRes || 'Y',
                      postSameAsRes: parsed.postSameAsRes || 'Y',
                      marketingOption: parsed.marketingOption || 'Y',
                      prefCorrLang: parsed.prefCorrLang || 'EN',
                      prefCorrMethod: parsed.prefCorrMethod || 'EMAIL',
                      stmtCorrMethod: parsed.stmtCorrMethod || 'EMAIL',
                      dealNumber: parsed.dealNumber || '',
                      error: ''
                    };

                    // Persist to customers.json for search integration
                    try {
                      const mockCustPath = path.resolve(__dirname, 'webapp/model/mockdata/customers.json');
                      if (fs.existsSync(mockCustPath)) {
                        const existingList = JSON.parse(fs.readFileSync(mockCustPath, 'utf-8'));
                        const newCust = {
                          bpNumber: sGeneratedBp,
                          BpId: sGeneratedBp,
                          name: sCustomerName,
                          CustomerName: sCustomerName,
                          firstName: parsed.fName || '',
                          lastName: parsed.sName || '',
                          title: parsed.title || 'Mr.',
                          telephone: parsed.cellPhone || '',
                          cellno: parsed.cellPhone || '',
                          email: parsed.eMail || '',
                          Email: parsed.eMail || '',
                          type: parsed.entityType || 'Individual',
                          EmpType: parsed.entityType || 'Individual',
                          companyName: parsed.coName || '',
                          regNo: parsed.coRegNumber || '',
                          vatNo: parsed.vatNumber || '',
                          idPassport: parsed.idNo || '',
                          IdNo: parsed.idNo || '',
                          idType: parsed.idType || 'SA ID',
                          dateOfBirth: parsed.dob || '',
                          gender: parsed.gender || 'Male',
                          Country: parsed.homeCountry || 'ZA',
                          address: {
                            street: parsed.homeStreeName || '',
                            city: parsed.homeCity || '',
                            suburb: parsed.homeSuburb || '',
                            region: parsed.homeProvince || '',
                            province: parsed.homeProvince || '',
                            postalCode: parsed.homePostalCode || '',
                            country: parsed.homeCountry || 'ZA',
                            formatted: [parsed.homeStreeName, parsed.homeSuburb, parsed.homeCity, parsed.homePostalCode, parsed.homeCountry || 'ZA'].filter(Boolean).join(', '),
                            status: 'EXISTING',
                            statusState: 'Success'
                          }
                        };
                        existingList.unshift(newCust);
                        fs.writeFileSync(mockCustPath, JSON.stringify(existingList, null, 2), 'utf-8');
                      }
                    } catch (err) {
                      console.warn('Could not persist to customers.json:', err);
                    }

                    res.statusCode = 201;
                    return res.end(JSON.stringify({ d: quickAppRecord }));
                  });
                  return;
                }

                // Query QuickAppSet (GET)
                const singleMatch = rawUrl.match(/QuickAppSet\((?:userId=)?'([^']+)'\)/i);
                if (singleMatch) {
                  const uid = decodeURIComponent(singleMatch[1]);
                  return res.end(JSON.stringify({
                    d: {
                      userId: uid,
                      bpId: '1000234571',
                      customerName: 'Thabo Mokoena',
                      error: ''
                    }
                  }));
                }

                return res.end(JSON.stringify({
                  d: {
                    results: []
                  }
                }));
              }

              // Root or other entity sets
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              return res.end(JSON.stringify({
                d: {
                  EntitySets: ['FullAppSet', 'SavedAppSet', 'PriceOverideSet', 'DebiCheckSet', 'DebiBankSet', 'DropDownsSet', 'StoreInfoSet', 'QuickAppSet', 'ReCalcQtaSet', 'PersistSet', 'ValidateAddressSet', 'ValidateBankAccSet', 'InsuranceTypesSet']
                }
              }));
            }

            // Handle ZSRA017_SALESORDER_CREATE_SRV OData service endpoints (Upload / Attachments)
            if (rawUrl.includes('/sap/opu/odata/sap/ZSRA017_SALESORDER_CREATE_SRV')) {
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
              res.setHeader('Access-Control-Allow-Headers', '*');
              res.setHeader('DataServiceVersion', '2.0');

              if (req.method === 'OPTIONS') {
                res.statusCode = 200;
                return res.end();
              }

              // Metadata request
              if (rawUrl.includes('/$metadata')) {
                res.setHeader('Content-Type', 'application/xml; charset=utf-8');
                const metaCandidates = [
                  path.resolve(__dirname, 'webapp/localService/ZSRA017_SALESORDER_CREATE_SRV/metadata.xml'),
                  path.resolve(__dirname, 'webapp/localService/SALESORDER_CREATE_metadata.xml'),
                  path.resolve(__dirname, 'public/assets/aistudio/SALESORDER_CREATE_8c413a8d.xml')
                ];
                for (const p of metaCandidates) {
                  if (fs.existsSync(p)) {
                    return res.end(fs.readFileSync(p, 'utf-8'));
                  }
                }
                return res.end('<edmx:Edmx xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx" Version="1.0"><edmx:DataServices m:DataServiceVersion="2.0"></edmx:DataServices></edmx:Edmx>');
              }

              // UploadSet query or create
              if (rawUrl.includes('UploadSet')) {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                if (req.method === 'POST') {
                  let body = '';
                  req.on('data', chunk => { body += chunk; });
                  req.on('end', () => {
                    let parsed: any = {};
                    try {
                      parsed = JSON.parse(body);
                    } catch (e) {
                      parsed = {};
                    }
                    const soNo = parsed.SoNo || 'DRAFT';
                    const fileName = parsed.FileName || 'attachment';
                    const fileType = parsed.FileType || 'DOC';
                    const fileData = parsed.FileData || '';
                    const uploadRecord = {
                      __metadata: {
                        id: `http://localhost:3000/sap/opu/odata/sap/ZSRA017_SALESORDER_CREATE_SRV/UploadSet(SoNo='${soNo}',FileType='${fileType}',FileData=binary'')`,
                        uri: `http://localhost:3000/sap/opu/odata/sap/ZSRA017_SALESORDER_CREATE_SRV/UploadSet(SoNo='${soNo}',FileType='${fileType}',FileData=binary'')`,
                        type: 'ZSRA017_SALESORDER_CREATE_SRV.Upload'
                      },
                      FileName: fileName,
                      SoNo: soNo,
                      FileType: fileType,
                      FileData: fileData
                    };
                    storedUploads.push(uploadRecord);
                    storedDocViews.push({
                      __metadata: {
                        id: `http://localhost:3000/sap/opu/odata/sap/ZSRA017_SALESORDER_CREATE_SRV/Doc_viewSet('${fileName}')`,
                        uri: `http://localhost:3000/sap/opu/odata/sap/ZSRA017_SALESORDER_CREATE_SRV/Doc_viewSet('${fileName}')`,
                        type: 'ZSRA017_SALESORDER_CREATE_SRV.Doc_view'
                      },
                      AttaId: fileName,
                      Descr: fileName,
                      FileData: fileData
                    });
                    res.statusCode = 201;
                    return res.end(JSON.stringify({ d: uploadRecord }));
                  });
                  return;
                }

                // Query UploadSet (optionally filtered by SoNo)
                const urlObj = new URL(rawUrl, 'http://localhost:3000');
                const filter = decodeURIComponent(urlObj.searchParams.get('$filter') || '');
                const soMatch = filter.match(/SoNo eq '([^']+)'/i);
                let list = storedUploads;
                if (soMatch) {
                  list = storedUploads.filter(u => u.SoNo === soMatch[1]);
                }

                return res.end(JSON.stringify({
                  d: {
                    results: list
                  }
                }));
              }

              // Doc_viewSet query
              if (rawUrl.includes('Doc_viewSet')) {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                return res.end(JSON.stringify({
                  d: {
                    results: storedDocViews
                  }
                }));
              }

              // Root or other entity sets
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              return res.end(JSON.stringify({
                d: {
                  EntitySets: ['PartnerAddressSet', 'CustomerSet', 'SalesOrderDetailsSet', 'SalesOrderSet', 'MaterialSet', 'UploadSet', 'Doc_viewSet']
                }
              }));
            }

            // Handle ZCUSTOMER_OVERVIEW_SRV OData service endpoints (Customer Lookup / CustomerSet)
            if (rawUrl.includes('/sap/opu/odata/sap/ZCUSTOMER_OVERVIEW_SRV')) {
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
              res.setHeader('Access-Control-Allow-Headers', '*');
              res.setHeader('DataServiceVersion', '2.0');

              if (req.method === 'OPTIONS') {
                res.statusCode = 200;
                return res.end();
              }

              // Metadata request
              if (rawUrl.includes('/$metadata')) {
                res.setHeader('Content-Type', 'application/xml; charset=utf-8');
                const metaCandidates = [
                  path.resolve(__dirname, 'webapp/localService/ZCUSTOMER_OVERVIEW_SRV/metadata.xml'),
                  path.resolve(__dirname, 'webapp/localService/ZCUSTOMER_OVERVIEW_metadata.xml'),
                  path.resolve(__dirname, 'public/assets/aistudio/ZCUSTOMER_OVERVIEW_Metadata_47bf8d4a.xml')
                ];
                for (const p of metaCandidates) {
                  if (fs.existsSync(p)) {
                    return res.end(fs.readFileSync(p, 'utf-8'));
                  }
                }
                return res.end('<edmx:Edmx xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx" Version="1.0"><edmx:DataServices m:DataServiceVersion="2.0"></edmx:DataServices></edmx:Edmx>');
              }

              // CustomerSet query
              if (rawUrl.includes('CustomerSet')) {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                const mockCustomersPath = path.resolve(__dirname, 'webapp/model/mockdata/customers.json');
                let rawList: any[] = [];
                if (fs.existsSync(mockCustomersPath)) {
                  try {
                    rawList = JSON.parse(fs.readFileSync(mockCustomersPath, 'utf-8'));
                  } catch (e) {
                    rawList = [];
                  }
                }

                // Map to ZCUSTOMER_OVERVIEW_SRV.Customer schema
                const customers = rawList.map((c: any) => ({
                  __metadata: {
                    id: `http://localhost:3000/sap/opu/odata/sap/ZCUSTOMER_OVERVIEW_SRV/CustomerSet('${c.bpNumber || c.BpId}')`,
                    uri: `http://localhost:3000/sap/opu/odata/sap/ZCUSTOMER_OVERVIEW_SRV/CustomerSet('${c.bpNumber || c.BpId}')`,
                    type: 'ZCUSTOMER_OVERVIEW_SRV.Customer'
                  },
                  BpId: String(c.bpNumber || c.BpId || ''),
                  title: c.title || 'Mr',
                  IdNo: c.idPassport || c.IdNo || '',
                  idType: c.idType || 'SA ID',
                  CustomerName: c.name || c.CustomerName || '',
                  fname: c.firstName || c.fname || '',
                  sname: c.lastName || c.sname || '',
                  inits: (c.firstName ? c.firstName.charAt(0) : 'T'),
                  gender: c.gender || 'Male',
                  ethnicity: c.ethnicity || 'African',
                  marstat: c.marstat || 'Single',
                  noOfDependant: c.noOfDependant || '0',
                  dob: c.dateOfBirth || c.dob || '1985-01-01',
                  ctzship: c.ctzship || 'South African',
                  empName: c.companyName || c.empName || '',
                  empPhone: c.telephone || c.empPhone || '',
                  empNumber: c.empNumber || 'EMP-01',
                  EmpType: c.type || c.EmpType || 'Individual',
                  empsect: c.empsect || 'Commerce',
                  termofEmpYY: '5',
                  termofEmpMM: '0',
                  grossInc: '35000.00',
                  compUnitNo: '',
                  Street: (c.address && c.address.street) || c.Street || '',
                  City: (c.address && c.address.city) || c.City || '',
                  suburb: (c.address && c.address.suburb) || c.suburb || '',
                  province: (c.address && c.address.region) || c.province || '',
                  Country: (c.address && c.address.country) || c.Country || 'ZA',
                  PostalCode: (c.address && c.address.postalCode) || c.PostalCode || '',
                  latitude: '-26.1076',
                  longitude: '28.0567',
                  cellno: c.telephone || c.cellno || '',
                  Telephone: c.telephone || c.Telephone || '',
                  Email: c.email || c.Email || '',
                  titleSpouse: '',
                  snameSpouse: '',
                  fnameSpouse: '',
                  initsSpouse: '',
                  cellnoSpouse: '',
                  ctzshipSpouse: '',
                  idTypeSpouse: '',
                  IdNoSpouse: '',
                  genderSpouse: '',
                  dobSpouse: '',
                  EmpTypeSpouse: '',
                  termofEmpYYSpouse: '',
                  termofEmpMMSpouse: '',
                  grossIncSpouse: '',
                  howMarried: '',
                  coName: c.companyName || (c.type === 'Company' ? c.name : ''),
                  coRegNumber: c.regNo || '',
                  coBpId: c.type === 'Company' ? c.bpNumber : '',
                  vatNumber: c.vatNo || '',
                  response: '',
                  accountNumber: c.accountNumber || ('ACC-' + (c.bpNumber || c.BpId)),
                  vcardNumber: '',
                  gfunction: '',
                  LoyaltyType: 'PLUSMORE',
                  LoyaltyNumber: 'PM-' + (c.bpNumber || c.BpId),
                  LoyaltyStatus: 'Active',
                  LoyaltyExpiry: '2028-12-31',
                  LoyaltyOtac: '',
                  site: 'M001'
                }));

                // Check for single key query: CustomerSet('1000234571') or CustomerSet(BpId='1000234571')
                const singleMatch = rawUrl.match(/CustomerSet\((?:BpId=)?'([^']+)'\)/i);
                if (singleMatch) {
                  const bp = decodeURIComponent(singleMatch[1]);
                  const found = customers.find((cust: any) => cust.BpId === bp) || customers[0];
                  return res.end(JSON.stringify({ d: found }));
                }

                // Check for filter or search
                const urlObj = new URL(rawUrl, 'http://localhost:3000');
                const filter = decodeURIComponent(urlObj.searchParams.get('$filter') || '').toLowerCase();
                const search = decodeURIComponent(urlObj.searchParams.get('$search') || '').toLowerCase();

                let filtered = customers;
                if (filter || search) {
                  // Parse explicit 'eq' comparisons: e.g. CustomerName eq 'John' or BpId eq '1000234571'
                  const eqMatches: Array<{ field: string; val: string }> = [];
                  const eqRegex = /([a-zA-Z0-9_]+)\s+eq\s+'([^']*)'/gi;
                  let m;
                  while ((m = eqRegex.exec(filter)) !== null) {
                    eqMatches.push({ field: m[1].toLowerCase(), val: m[2].trim().toLowerCase() });
                  }

                  filtered = customers.filter((cust: any) => {
                    if (eqMatches.length > 0) {
                      const matchesAllEq = eqMatches.every(({ field, val }) => {
                        if (!val) return true;
                        switch (field) {
                          case 'bpid':
                            return (cust.BpId || '').toLowerCase() === val;
                          case 'customername':
                            return (cust.CustomerName || '').toLowerCase().includes(val) ||
                                   `${cust.fname || ''} ${cust.sname || ''}`.toLowerCase().includes(val);
                          case 'idno':
                            return (cust.IdNo || '').toLowerCase() === val;
                          case 'cellno':
                          case 'telephone':
                            return (cust.cellno || cust.Telephone || '').toLowerCase().replace(/\s+/g, '').includes(val.replace(/\s+/g, ''));
                          case 'email':
                            return (cust.Email || '').toLowerCase().includes(val);
                          case 'accountnumber':
                            return (cust.accountNumber || '').toLowerCase() === val;
                          case 'loyaltynumber':
                            return (cust.LoyaltyNumber || '').toLowerCase() === val;
                          case 'country':
                            return (cust.Country || 'za').toLowerCase() === val;
                          default:
                            return (cust[field] || '').toString().toLowerCase().includes(val);
                        }
                      });
                      if (matchesAllEq) return true;
                    }

                    const textToSearch = [
                      cust.BpId,
                      cust.CustomerName,
                      cust.fname,
                      cust.sname,
                      cust.IdNo,
                      cust.cellno,
                      cust.Telephone,
                      cust.Email,
                      cust.coName,
                      cust.accountNumber,
                      cust.LoyaltyNumber,
                      cust.Country
                    ].join(' ').toLowerCase();

                    if (search && textToSearch.includes(search)) return true;

                    // Match individual terms in filter
                    const tokens = filter.replace(/[()',]/g, ' ')
                      .split(/\s+/)
                      .filter(t => t.length > 1 && !['eq', 'ne', 'and', 'or', 'not', 'substringof', 'tolower', 'customername', 'bpid', 'idno', 'cellno', 'email', 'accountnumber', 'loyaltynumber', 'country', 'za'].includes(t));
                    if (tokens.length === 0) return true;
                    return tokens.every(t => textToSearch.includes(t)) || tokens.some(t => textToSearch.includes(t));
                  });
                }

                return res.end(JSON.stringify({
                  d: {
                    results: filtered
                  }
                }));
              }

              // Root or other entity sets
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              return res.end(JSON.stringify({
                d: {
                  EntitySets: ['CustomerSet', 'AccountsSet', 'DocumentsSet', 'ApplicationDetailSet', 'BiometricsSet', 'CustomerSmsSet']
                }
              }));
            }

            if (rawUrl.startsWith('/@') || rawUrl.startsWith('/src/') || rawUrl.includes('/node_modules/')) {
              return next();
            }

            const cleanUrl = rawUrl.split('?')[0].replace(/^\//, '');
            if (!cleanUrl || cleanUrl === 'index.html') {
              return next();
            }

            const resolveCandidate = (p: string) => {
              const abs1 = path.resolve(__dirname, p);
              if (fs.existsSync(abs1) && fs.statSync(abs1).isFile()) return abs1;
              const abs2 = path.resolve(__dirname, 'webapp', p);
              if (fs.existsSync(abs2) && fs.statSync(abs2).isFile()) return abs2;
              return null;
            };

            const filePath = resolveCandidate(cleanUrl);

            if (filePath) {
              const ext = path.extname(filePath).toLowerCase();
              const mime = MIME_MAP[ext];
              if (mime) {
                res.setHeader('Content-Type', mime);
                res.setHeader('Access-Control-Allow-Origin', '*');
                const content = fs.readFileSync(filePath);
                return res.end(content);
              }
            }

            next();
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
