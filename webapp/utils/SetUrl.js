sap.ui.define([], function () {
  "use strict";

  return {
    /**
     * Resolves service URL for OData endpoints
     * @param {string} sServiceKey
     * @returns {string} Service URL
     */
    setUrl: function (sServiceKey) {
      switch (sServiceKey) {
        case "article":
          return "/sap/opu/odata/sap/ZECC_ARTICLELIST_SRV_01";
        case "tvLicense":
          return "/sap/opu/odata/sap/ZECC_ARTICLELIST_SRV_01";
        case "dealGet":
          return "/sap/opu/odata/sap/ZECC_ARTICLELIST_SRV_01";
        case "dealUpdate":
          return "/sap/opu/odata/sap/ZECC_ARTICLELIST_SRV_01";
        case "getSo":
          return "/sap/opu/odata/sap/ZECC_ARTICLELIST_SRV_01";
        default:
          return "/sap/opu/odata/sap/ZECC_ARTICLELIST_SRV_01";
      }
    }
  };
});
