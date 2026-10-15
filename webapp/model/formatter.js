sap.ui.define([
  "sap/ui/core/format/NumberFormat"
], function (NumberFormat) {
  "use strict";

  return {
    /**
     * Formats currency amounts in South African Rand (R)
     */
    formatCurrency: function (fValue, sCurrency) {
      if (fValue === undefined || fValue === null || isNaN(fValue)) {
        return "R 0.00";
      }
      var oCurrencyFormat = NumberFormat.getCurrencyInstance({
        currencyCode: false,
        customCurrencies: {
          "ZAR": {
            symbol: "R",
            decimals: 2
          }
        }
      });
      var sFormatted = oCurrencyFormat.format(fValue, "ZAR");
      return "R " + sFormatted.replace("ZAR", "").trim();
    },

    /**
     * Maps address status to ValueState for ObjectStatus / ObjectMarker
     */
    addressStatusState: function (sStatus) {
      switch (sStatus) {
        case "EXISTING":
          return "Success";
        case "MODIFIED":
          return "Warning";
        case "NEW":
          return "Information";
        case "VERIFIED":
          return "Information";
        case "USED BEFORE":
          return "None";
        default:
          return "None";
      }
    },

    /**
     * Returns true if status is EXISTING
     */
    isExistingStatus: function (sStatus) {
      return sStatus === "EXISTING";
    },

    /**
     * Quantity multiplier string for display
     */
    formatQtyMultiplier: function (nQty, fPrice) {
      if (!nQty || !fPrice) return "";
      return nQty + " × " + this.formatCurrency(fPrice);
    },

    /**
     * Formats plain price without currency prefix (e.g. 1000 or 499.83)
     */
    formatPriceOnly: function (fValue) {
      if (fValue === undefined || fValue === null || isNaN(fValue)) {
        return "0";
      }
      var n = Number(fValue);
      return (n % 1 === 0) ? String(n) : n.toFixed(2);
    },

    /**
     * Formats quantity with 3 decimal places (e.g. 870.000)
     */
    formatQtyDecimal: function (nQty) {
      if (nQty === undefined || nQty === null || isNaN(nQty)) {
        return "1.000";
      }
      return Number(nQty).toFixed(3);
    }
  };
});
