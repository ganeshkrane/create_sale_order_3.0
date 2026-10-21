sap.ui.define([
  "sap/ui/salesorder/store/controller/BaseController",
  "sap/ui/model/json/JSONModel",
  "sap/ui/salesorder/store/model/formatter",
  "sap/ui/core/routing/History",
  "sap/m/MessageToast",
  "sap/m/MessageBox",
  "sap/ui/core/Fragment",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator"
], function (BaseController, JSONModel, formatter, History, MessageToast, MessageBox, Fragment, Filter, FilterOperator) {
  "use strict";

  return BaseController.extend("sap.ui.salesorder.store.controller.SalesOrderDetail", {
    formatter: formatter,

    onInit: function () {
      this.getView().setModel(new JSONModel({
        isEditMode: false,
        productSearchQuery: ""
      }), "ui");

      var oRouter = this.getRouter();
      if (oRouter) {
        oRouter.getRoute("salesOrderDetail").attachPatternMatched(this._onRouteMatched, this);
      }
    },

    _onRouteMatched: function (oEvent) {
      // Always reset edit mode when navigating to an order
      var oUiModel = this.getView().getModel("ui");
      if (oUiModel) {
        oUiModel.setProperty("/isEditMode", false);
        oUiModel.setProperty("/productSearchQuery", "");
      }
      this._oOrderBackup = null;

      var sOrderId = oEvent.getParameter("arguments").orderId;
      this._loadOrderDetail(sOrderId);
    },

    _loadOrderDetail: function (sOrderId) {
      var oSalesOrdersModel = this.getOwnerComponent().getModel("salesOrders");
      var aOrders = (oSalesOrdersModel && oSalesOrdersModel.getProperty("/orders")) || [];

      if (!aOrders || aOrders.length === 0) {
        try {
          var sStored = localStorage.getItem("sap_sales_orders_store");
          if (sStored) {
            aOrders = JSON.parse(sStored);
          }
        } catch (e) {
          // ignore
        }
      }

      var oOrder = (aOrders || []).find(function (ord) {
        return String(ord.salesOrderNo) === String(sOrderId);
      });

      if (oOrder) {
        this._prepareAndSetOrderModel(oOrder);
      } else {
        // Fallback fetch if model was not yet loaded
        var sUrl = sap.ui.require.toUrl("sap/ui/salesorder/store/model/mockdata/salesOrders.json");
        fetch(sUrl)
          .then(function (res) { return res.json(); })
          .then(function (data) {
            var found = (data || []).find(function (ord) {
              return String(ord.salesOrderNo) === String(sOrderId);
            }) || (data && data[0]);

            if (found) {
              this._prepareAndSetOrderModel(found);
            }
          }.bind(this))
          .catch(function () {});
      }
    },

    _prepareAndSetOrderModel: function (oOrder) {
      if (oOrder) {
        this._recalculateTotals(oOrder);

        // Ensure attachments array is populated from order or review shipping wizard
        if (!oOrder.attachments || oOrder.attachments.length === 0) {
          var oAppState = this.getOwnerComponent().getModel("appState");
          var aWizardAtts = (oAppState && oAppState.getProperty("/delivery/attachments")) || [];
          if (aWizardAtts && aWizardAtts.length > 0) {
            oOrder.attachments = JSON.parse(JSON.stringify(aWizardAtts));
          } else {
            oOrder.attachments = [];
          }
        }

        // Ensure POS Transaction and Delivery Block
        if (!oOrder.posTransaction) {
          oOrder.posTransaction = "POS-TRX-" + (oOrder.salesOrderNo || "2026-94821");
        }
        if (!oOrder.deliveryBlock) {
          oOrder.deliveryBlock = "NONE";
        }
        var mDeliveryBlocks = {
          "01": "01 – Credit Limit Exceeded",
          "02": "02 – Political / Legal Reason",
          "03": "03 – Price Incomplete",
          "04": "04 – Manual Delivery Hold",
          "05": "05 – Payment Pending",
          "NONE": "None"
        };
        oOrder.deliveryBlockText = mDeliveryBlocks[oOrder.deliveryBlock] || oOrder.deliveryBlock || "None";

        if (!oOrder.shipmentPriority) {
          oOrder.shipmentPriority = "01";
        }
        if (!oOrder.shipmentPriorityText) {
          oOrder.shipmentPriorityText = oOrder.shipmentPriority === "01" ? "01 - Immediate" : (oOrder.shipmentPriority === "02" ? "02 - High Priority" : "03 - Standard Routing");
        }

        if (!oOrder.deliveryMethodTitle) {
          oOrder.deliveryMethodTitle = oOrder.deliveryMethod === "CND" ? "Delivery (CND)" : (oOrder.deliveryMethod === "CNC" ? "Click & Collect (CNC)" : "BOPIS (CNP)");
        }

        // Ensure Financial Details (matching Screenshot 2)
        if (!oOrder.financial) {
          var fTot = Number(oOrder.totalAmount || (oOrder.pricing && oOrder.pricing.total) || 35301.55);
          oOrder.financial = {
            totalPriceInclTax: fTot,
            requestedDownpayment: fTot,
            receivedDownpayment: fTot
          };
        }

        this.getView().setModel(new JSONModel(oOrder), "selectedOrder");
      }
    },

    /* =========================================================== */
    /* Edit Mode Actions (Edit, Cancel, Save)                      */
    /* =========================================================== */
    onEditOrder: function () {
      var oModel = this.getView().getModel("selectedOrder");
      if (!oModel) {
        return;
      }
      // Make a deep clone backup of the sales order
      this._oOrderBackup = JSON.parse(JSON.stringify(oModel.getData()));
      this.getView().getModel("ui").setProperty("/isEditMode", true);
      MessageToast.show("Edit mode enabled. You can now modify fields across all tabs.");
    },

    onCancelEdit: function () {
      if (this._oOrderBackup) {
        var oModel = this.getView().getModel("selectedOrder");
        oModel.setData(this._oOrderBackup);
        this._oOrderBackup = null;
      }
      this.getView().getModel("ui").setProperty("/isEditMode", false);
      MessageToast.show("Editing cancelled. Changes discarded.");
    },

    onSaveEdit: function () {
      var oModel = this.getView().getModel("selectedOrder");
      if (!oModel) {
        return;
      }
      var oOrder = oModel.getData();

      // Recalculate financial totals
      this._recalculateTotals(oOrder);

      // Sync descriptive texts
      if (oOrder.orderType === "ZOR") {
        oOrder.orderTypeDesc = "ZOR - Standard Store Order";
      } else if (oOrder.orderType === "ZDL") {
        oOrder.orderTypeDesc = "ZDL - Delivery Order";
      } else if (oOrder.orderType === "ZSP") {
        oOrder.orderTypeDesc = "ZSP - Special / Supply Order";
      }

      if (oOrder.deliveryMethod === "CND") {
        oOrder.deliveryMethodTitle = "Delivery (CND)";
      } else if (oOrder.deliveryMethod === "CNC") {
        oOrder.deliveryMethodTitle = "Click & Collect (CNC)";
      } else if (oOrder.deliveryMethod === "CNP") {
        oOrder.deliveryMethodTitle = "BOPIS (CNP)";
      }

      if (oOrder.shipmentPriority === "01") {
        oOrder.shipmentPriorityText = "01 - Immediate";
      } else if (oOrder.shipmentPriority === "02") {
        oOrder.shipmentPriorityText = "02 - High Priority";
      } else if (oOrder.shipmentPriority === "03") {
        oOrder.shipmentPriorityText = "03 - Standard Routing";
      }

      var mDeliveryBlocks = {
        "01": "01 – Credit Limit Exceeded",
        "02": "02 – Political / Legal Reason",
        "03": "03 – Price Incomplete",
        "04": "04 – Manual Delivery Hold",
        "05": "05 – Payment Pending",
        "NONE": "None"
      };
      oOrder.deliveryBlockText = mDeliveryBlocks[oOrder.deliveryBlock] || oOrder.deliveryBlock || "None";

      // Persist changes
      this._updateOrderInPersistence(oOrder);
      oModel.refresh(true);

      this._oOrderBackup = null;
      this.getView().getModel("ui").setProperty("/isEditMode", false);
      MessageToast.show("Sales Order " + oOrder.salesOrderNo + " updated successfully.");
    },

    /* =========================================================== */
    /* Header & General Field Handlers                             */
    /* =========================================================== */
    onPosTransactionChange: function (oEvent) {
      var sValue = oEvent.getParameter("value");
      var oModel = this.getView().getModel("selectedOrder");
      if (oModel) {
        oModel.setProperty("/posTransaction", sValue);
      }
    },

    onDeliveryBlockChange: function (oEvent) {
      var oSelectedItem = oEvent.getParameter("selectedItem");
      var sKey = oSelectedItem ? oSelectedItem.getKey() : "NONE";
      var sText = oSelectedItem ? oSelectedItem.getText() : "None";
      var oModel = this.getView().getModel("selectedOrder");
      if (oModel) {
        oModel.setProperty("/deliveryBlock", sKey);
        oModel.setProperty("/deliveryBlockText", sText);
      }
    },

    onOrderTypeChange: function (oEvent) {
      var oItem = oEvent.getParameter("selectedItem");
      if (oItem) {
        var oModel = this.getView().getModel("selectedOrder");
        oModel.setProperty("/orderType", oItem.getKey());
        oModel.setProperty("/orderTypeDesc", oItem.getText());
      }
    },

    onDeliveryMethodSelectChange: function (oEvent) {
      var oItem = oEvent.getParameter("selectedItem");
      if (oItem) {
        var oModel = this.getView().getModel("selectedOrder");
        oModel.setProperty("/deliveryMethod", oItem.getKey());
        oModel.setProperty("/deliveryMethodTitle", oItem.getText());
      }
    },

    onShipmentPriorityChange: function (oEvent) {
      var oItem = oEvent.getParameter("selectedItem");
      if (oItem) {
        var oModel = this.getView().getModel("selectedOrder");
        oModel.setProperty("/shipmentPriority", oItem.getKey());
        oModel.setProperty("/shipmentPriorityText", oItem.getText());
      }
    },

    /* =========================================================== */
    /* Cart Summary Editing (Qty +/- , Remove, Add Article)        */
    /* =========================================================== */
    onIncreaseItemQty: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext("selectedOrder");
      if (!oContext) {
        return;
      }
      var oItem = oContext.getObject();
      var iQty = Number(oItem.qty || 1) + 1;
      var oModel = this.getView().getModel("selectedOrder");
      oModel.setProperty(oContext.getPath() + "/qty", iQty);
      var nPrice = Number(oItem.netPrice !== undefined ? oItem.netPrice : (oItem.price || 0));
      oModel.setProperty(oContext.getPath() + "/netValue", iQty * nPrice);
      this._recalculateTotals(oModel.getData());
      oModel.refresh(true);
    },

    onDecreaseItemQty: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext("selectedOrder");
      if (!oContext) {
        return;
      }
      var oItem = oContext.getObject();
      var iQty = Math.max(1, Number(oItem.qty || 1) - 1);
      var oModel = this.getView().getModel("selectedOrder");
      oModel.setProperty(oContext.getPath() + "/qty", iQty);
      var nPrice = Number(oItem.netPrice !== undefined ? oItem.netPrice : (oItem.price || 0));
      oModel.setProperty(oContext.getPath() + "/netValue", iQty * nPrice);
      this._recalculateTotals(oModel.getData());
      oModel.refresh(true);
    },

    onRemoveItem: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext("selectedOrder");
      if (!oContext) {
        return;
      }
      var sPath = oContext.getPath();
      var iIndex = parseInt(sPath.split("/").pop(), 10);
      var oModel = this.getView().getModel("selectedOrder");
      var aItems = oModel.getProperty("/items") || [];
      if (aItems.length <= 1) {
        MessageToast.show("An order must have at least one product.");
        return;
      }
      aItems.splice(iIndex, 1);
      aItems.forEach(function (it, idx) {
        it.item = String((idx + 1) * 10);
      });
      oModel.setProperty("/items", aItems);
      this._recalculateTotals(oModel.getData());
      oModel.refresh(true);
      MessageToast.show("Item removed from cart.");
    },

    onOpenAddArticleDialog: function () {
      var oView = this.getView();
      var that = this;

      this.getView().getModel("ui").setProperty("/productSearchQuery", "");

      var oExistingDialog = this.byId("addArticleDialog");
      if (oExistingDialog) {
        var oTable = Fragment.byId(oView.getId(), "selectProductTable");
        if (oTable && oTable.getBinding("items")) {
          oTable.getBinding("items").filter([]);
          if (oTable.removeSelections) {
            oTable.removeSelections(true);
          }
        }
        oExistingDialog.open();
        return;
      }

      if (!this._pAddArticleDialog) {
        this._pAddArticleDialog = Fragment.load({
          id: oView.getId(),
          name: "sap.ui.salesorder.store.view.fragments.AddArticleDialog",
          controller: this
        }).then(function (oDialog) {
          oView.addDependent(oDialog);
          return oDialog;
        }).catch(function (oErr) {
          that._pAddArticleDialog = null;
          console.error("Error loading AddArticleDialog:", oErr);
          MessageToast.show("Failed to open Select Product dialog: " + (oErr.message || oErr));
        });
      }

      if (this._pAddArticleDialog) {
        this._pAddArticleDialog.then(function (oDialog) {
          if (oDialog) {
            var oTable = Fragment.byId(oView.getId(), "selectProductTable");
            if (oTable && oTable.getBinding("items")) {
              oTable.getBinding("items").filter([]);
              if (oTable.removeSelections) {
                oTable.removeSelections(true);
              }
            }
            oDialog.open();
          }
        });
      }
    },

    onCloseAddArticleDialog: function () {
      var oExistingDialog = this.byId("addArticleDialog");
      if (oExistingDialog) {
        oExistingDialog.close();
      } else if (this._pAddArticleDialog) {
        this._pAddArticleDialog.then(function (oDialog) {
          if (oDialog) {
            oDialog.close();
          }
        });
      }
    },

    onLiveSearchDialogProducts: function (oEvent) {
      var sQuery = oEvent.getParameter("newValue") || oEvent.getParameter("query") || "";
      var aFilters = [];
      if (sQuery && sQuery.trim().length > 0) {
        sQuery = sQuery.trim();
        aFilters.push(new Filter({
          filters: [
            new Filter("name", FilterOperator.Contains, sQuery),
            new Filter("articleId", FilterOperator.Contains, sQuery),
            new Filter("category", FilterOperator.Contains, sQuery),
            new Filter("site", FilterOperator.Contains, sQuery),
            new Filter("itemCat", FilterOperator.Contains, sQuery)
          ],
          and: false
        }));
      }
      var oTable = Fragment.byId(this.getView().getId(), "selectProductTable");
      if (oTable) {
        var oBinding = oTable.getBinding("items");
        if (oBinding) {
          oBinding.filter(aFilters);
        }
      }
    },

    onSelectProductFromDialogRow: function (oEvent) {
      var oTable = oEvent.getSource();
      var oListItem = oEvent.getParameter("listItem");
      if (!oListItem && oTable && oTable.getSelectedItem) {
        oListItem = oTable.getSelectedItem();
      }
      if (oListItem) {
        var oProduct = oListItem.getBindingContext("products").getObject();
        this._addProductToSelectedOrder(oProduct);
      }
      if (oTable && oTable.removeSelections) {
        oTable.removeSelections(true);
      }
      this.onCloseAddArticleDialog();
    },

    _addProductToSelectedOrder: function (oProduct) {
      if (!oProduct) {
        return;
      }
      var oModel = this.getView().getModel("selectedOrder");
      var aItems = oModel.getProperty("/items") || [];
      var iNextItemNo = (aItems.length + 1) * 10;
      var nPrice = Number(oProduct.price || 0);

      var oNewItem = {
        item: String(iNextItemNo),
        articleId: oProduct.articleId || ("ART-" + iNextItemNo),
        name: oProduct.name || "New Article",
        description: oProduct.name || "New Article",
        category: oProduct.category || "General Merchandise",
        qty: 1,
        netPrice: nPrice,
        price: nPrice,
        netValue: nPrice,
        currency: oProduct.currency || "ZAR",
        um: oProduct.um || "EA",
        site: oProduct.site || "M001",
        itemCat: oProduct.itemCat || "TAN",
        routingTarget: oProduct.oaaSource || "OAA Source (M001) · SP-01",
        sourcingStatusText: oProduct.sourcingResponse || "Full stock available"
      };

      aItems.push(oNewItem);
      oModel.setProperty("/items", aItems);
      this._recalculateTotals(oModel.getData());
      oModel.refresh(true);
      MessageToast.show("Added " + oProduct.name + " to order.");
    },

    /* =========================================================== */
    /* Price Override Popup & Handling                             */
    /* =========================================================== */
    onOpenPriceOverrideDialog: function (oEvent) {
      var oSource = oEvent.getSource();
      var oContext = oSource.getBindingContext("selectedOrder");
      if (!oContext) {
        return;
      }
      var oItem = oContext.getObject();
      this._priceOverrideItem = oItem;
      this._priceOverrideContext = oContext;

      var oPriceOverrideModel = this.getView().getModel("priceOverrideModel");
      if (!oPriceOverrideModel) {
        oPriceOverrideModel = new JSONModel({});
        this.getView().setModel(oPriceOverrideModel, "priceOverrideModel");
      }

      var currentPrice = oItem.netPrice !== undefined ? oItem.netPrice : (oItem.price || 0);
      oPriceOverrideModel.setData({
        itemNo: oItem.item,
        itemName: oItem.name || oItem.description,
        managerAuth: "EMP-8472",
        currentPrice: currentPrice,
        newPrice: String(currentPrice)
      });

      this._openPriceOverridePopup();
    },

    _openPriceOverridePopup: function () {
      var oView = this.getView();
      var that = this;

      var oExistingDialog = this.byId("priceOverrideDialog");
      if (oExistingDialog) {
        oExistingDialog.open();
        return;
      }

      if (!this._pPriceOverrideDialog) {
        this._pPriceOverrideDialog = Fragment.load({
          id: oView.getId(),
          name: "sap.ui.salesorder.store.view.fragments.PriceOverrideDialog",
          controller: this
        }).then(function (oDialog) {
          oView.addDependent(oDialog);
          return oDialog;
        }).catch(function (oErr) {
          that._pPriceOverrideDialog = null;
          console.error("Error loading PriceOverrideDialog:", oErr);
          MessageToast.show("Failed to open Price Override popup: " + (oErr.message || oErr));
        });
      }

      if (this._pPriceOverrideDialog) {
        this._pPriceOverrideDialog.then(function (oDialog) {
          if (oDialog) {
            oDialog.open();
          }
        });
      }
    },

    onCancelPriceOverride: function () {
      var oExistingDialog = this.byId("priceOverrideDialog");
      if (oExistingDialog) {
        oExistingDialog.close();
      } else if (this._pPriceOverrideDialog) {
        this._pPriceOverrideDialog.then(function (oDialog) {
          if (oDialog) {
            oDialog.close();
          }
        });
      }
    },

    onConfirmPriceOverride: function () {
      var oPriceOverrideModel = this.getView().getModel("priceOverrideModel");
      if (!oPriceOverrideModel) {
        return;
      }
      var sNewPrice = oPriceOverrideModel.getProperty("/newPrice");
      if (sNewPrice === undefined || sNewPrice === null || String(sNewPrice).trim() === "") {
        MessageBox.warning("Please enter a new sales price.");
        return;
      }

      var fNewPrice = parseFloat(sNewPrice);
      if (isNaN(fNewPrice) || fNewPrice < 0) {
        MessageBox.warning("Please enter a valid numeric sales price.");
        return;
      }

      var oItem = this._priceOverrideItem;
      if (!oItem && this._priceOverrideContext) {
        oItem = this._priceOverrideContext.getObject();
      }

      if (oItem) {
        var oModel = this.getView().getModel("selectedOrder");
        var nQty = Number(oItem.qty || 1);
        oItem.netPrice = fNewPrice;
        oItem.price = fNewPrice;
        oItem.netValue = +(nQty * fNewPrice).toFixed(2);

        this._recalculateTotals(oModel.getData());
        oModel.refresh(true);

        var oUiModel = this.getView().getModel("ui");
        if (oUiModel && !oUiModel.getProperty("/isEditMode")) {
          this._oOrderBackup = JSON.parse(JSON.stringify(oModel.getData()));
          oUiModel.setProperty("/isEditMode", true);
          MessageToast.show("Price overridden to " + fNewPrice.toFixed(2) + ". Save changes when ready.");
        } else {
          MessageToast.show("Price overridden to " + fNewPrice.toFixed(2) + " for Item " + oItem.item);
        }
      }

      this.onCancelPriceOverride();
    },

    /* =========================================================== */
    /* Value-Add Services Popup & Handling                         */
    /* =========================================================== */
    onOpenValueAddPopup: function (oEvent) {
      var oSource = oEvent.getSource();
      var oContext = oSource.getBindingContext("selectedOrder");
      this._selectedParentCartItem = oContext ? oContext.getObject() : null;
      var sMainArticle = (this._selectedParentCartItem && this._selectedParentCartItem.articleId) || "ART-1000";

      var aAddonProducts = [
        { mainArticle: sMainArticle, addonArticle: "AD-1001", description: "Extended Warranty - 1 Year", price: "499.00" },
        { mainArticle: sMainArticle, addonArticle: "AD-1002", description: "Protective Carry Case / Mount", price: "249.50" },
        { mainArticle: sMainArticle, addonArticle: "AD-1003", description: "Wireless Charging & Cable Pack", price: "799.00" },
        { mainArticle: sMainArticle, addonArticle: "AD-1004", description: "Premium Installation & Support", price: "999.00" },
        { mainArticle: sMainArticle, addonArticle: "AD-1005", description: "Surge Protection Power Adapter", price: "199.95" }
      ];

      var oValueAddModel = this.getView().getModel("valueAddModel");
      if (!oValueAddModel) {
        oValueAddModel = new JSONModel({ items: aAddonProducts, allItems: aAddonProducts });
        this.getView().setModel(oValueAddModel, "valueAddModel");
      } else {
        oValueAddModel.setProperty("/items", aAddonProducts);
        oValueAddModel.setProperty("/allItems", aAddonProducts);
      }

      var oView = this.getView();
      var that = this;

      if (!this._pValueAddDialog) {
        this._pValueAddDialog = Fragment.load({
          id: oView.getId(),
          name: "sap.ui.salesorder.store.view.fragments.ValueAddDialog",
          controller: this
        }).then(function (oDialog) {
          oView.addDependent(oDialog);
          return oDialog;
        }).catch(function (oErr) {
          that._pValueAddDialog = null;
          console.error("Error loading ValueAddDialog:", oErr);
          MessageToast.show("Failed to open Value-Add dialog: " + (oErr.message || oErr));
        });
      }

      if (this._pValueAddDialog) {
        this._pValueAddDialog.then(function (oDialog) {
          if (oDialog) {
            var oTable = Fragment.byId(oView.getId(), "valueAddTable");
            if (oTable && oTable.removeSelections) {
              oTable.removeSelections(true);
            }
            var oSearchField = Fragment.byId(oView.getId(), "valueAddSearchField");
            if (oSearchField) {
              oSearchField.setValue("");
            }
            oDialog.open();
          }
        });
      }
    },

    onLiveSearchValueAdd: function (oEvent) {
      var sValue = (oEvent.getParameter("newValue") || "").toLowerCase().trim();
      var oModel = this.getView().getModel("valueAddModel");
      if (!oModel) {
        return;
      }
      var aAll = oModel.getProperty("/allItems") || [];
      if (!sValue) {
        oModel.setProperty("/items", aAll);
      } else {
        var aFiltered = aAll.filter(function (it) {
          return (it.addonArticle || "").toLowerCase().indexOf(sValue) !== -1 ||
                 (it.description || "").toLowerCase().indexOf(sValue) !== -1 ||
                 (it.mainArticle || "").toLowerCase().indexOf(sValue) !== -1;
        });
        oModel.setProperty("/items", aFiltered);
      }
    },

    onCloseValueAddDialog: function () {
      var oExistingDialog = this.byId("valueAddDialog");
      if (oExistingDialog) {
        oExistingDialog.close();
      } else if (this._pValueAddDialog) {
        this._pValueAddDialog.then(function (oDialog) {
          if (oDialog) {
            oDialog.close();
          }
        });
      }
    },

    onConfirmValueAddSelection: function () {
      var oView = this.getView();
      var oTable = Fragment.byId(oView.getId(), "valueAddTable");
      var aSelected = oTable ? oTable.getSelectedItems() : [];

      if (!aSelected || aSelected.length === 0) {
        MessageToast.show("Please select at least one add-on item.");
        return;
      }

      var oModel = this.getView().getModel("selectedOrder");
      var aItems = oModel.getProperty("/items") || [];
      var oParent = this._selectedParentCartItem;
      var sParentItem = oParent ? oParent.item : "10";
      var nParentQty = (oParent && oParent.qty) ? oParent.qty : 1;

      // Auto-enable edit mode if not already
      var oUiModel = this.getView().getModel("ui");
      if (oUiModel && !oUiModel.getProperty("/isEditMode")) {
        this._oOrderBackup = JSON.parse(JSON.stringify(oModel.getData()));
        oUiModel.setProperty("/isEditMode", true);
      }

      aSelected.forEach(function (oSelectedItem) {
        var oAddon = oSelectedItem.getBindingContext("valueAddModel").getObject();
        var fPrice = parseFloat(oAddon.price) || 0;
        var iSubItemNo = (aItems.length + 1) * 10;

        var oNewSubItem = {
          item: String(iSubItemNo),
          articleId: oAddon.addonArticle,
          name: oAddon.description,
          description: oAddon.description,
          category: "Value-Add Services",
          qty: nParentQty,
          netPrice: fPrice,
          price: fPrice,
          netValue: +(nParentQty * fPrice).toFixed(2),
          currency: "ZAR",
          um: "EA",
          site: oParent ? oParent.site : "M001",
          itemCat: "TAP",
          routingTarget: "Value-Add · Attached to Item " + sParentItem,
          sourcingStatusText: "Service Available",
          isSubItem: true,
          isValueAdd: true,
          parentItem: sParentItem
        };

        aItems.push(oNewSubItem);
      });

      oModel.setProperty("/items", aItems);
      this._recalculateTotals(oModel.getData());
      oModel.refresh(true);

      MessageToast.show("Added " + aSelected.length + " value-add item(s). Save changes when ready.");
      this.onCloseValueAddDialog();
    },

    _recalculateTotals: function (oOrder) {
      if (!oOrder) {
        return;
      }
      var fNet = 0;
      (oOrder.items || []).forEach(function (it) {
        var nQty = Number(it.qty || 1);
        var nPrice = Number(it.netPrice !== undefined ? it.netPrice : (it.price || 0));
        it.netPrice = nPrice;
        it.netValue = nQty * nPrice;
        fNet += it.netValue;
      });
      var fVat = Math.round(fNet * 0.15 * 100) / 100;
      var fTotal = Math.round((fNet + fVat) * 100) / 100;
      oOrder.pricing = {
        netValue: fNet,
        discounts: 0,
        vat: fVat,
        total: fTotal
      };
      oOrder.totalAmount = fTotal;
      oOrder.itemsCount = (oOrder.items || []).length;

      if (!oOrder.financial) {
        oOrder.financial = {};
      }
      oOrder.financial.totalPriceInclTax = fTotal;
      oOrder.financial.requestedDownpayment = fTotal;
      oOrder.financial.receivedDownpayment = fTotal;
    },

    /* =========================================================== */
    /* Attachments Editing & Uploading                             */
    /* =========================================================== */
    onFileSizeExceed: function (oEvent) {
      MessageBox.error("File size exceeds 2MB limit. Please upload a smaller file.", {
        title: "File Size Limit Exceeded"
      });
    },

    onFileSelected: function (oEvent) {
      var oUploader = oEvent.getSource();
      var aFiles = oEvent.getParameter("files");
      var oFile = (aFiles && aFiles.length > 0)
        ? aFiles[0]
        : (oUploader.getDomRef && oUploader.getDomRef("fu") && oUploader.getDomRef("fu").files ? oUploader.getDomRef("fu").files[0] : null);

      if (!oFile) {
        return;
      }

      var MAX_SIZE = 2 * 1024 * 1024;
      if (oFile.size > MAX_SIZE) {
        var nSizeMb = (oFile.size / (1024 * 1024)).toFixed(2);
        MessageBox.error("File size exceeds 2MB limit. The selected file is " + nSizeMb + " MB.", {
          title: "File Size Limit Exceeded"
        });
        if (oUploader && typeof oUploader.clear === "function") {
          oUploader.clear();
        }
        return;
      }

      var that = this;
      var oReader = new FileReader();
      oReader.onload = function (e) {
        var sDataUrl = e.target.result;
        var sFileName = oFile.name;
        var isPdf = sFileName.toLowerCase().endsWith(".pdf") || oFile.type === "application/pdf";
        var sSizeFormatted = oFile.size >= 1024 * 1024
          ? (oFile.size / (1024 * 1024)).toFixed(1) + " MB"
          : (oFile.size / 1024).toFixed(1) + " KB";

        var sBase64Data = "";
        if (typeof sDataUrl === "string" && sDataUrl.indexOf(",") !== -1) {
          sBase64Data = sDataUrl.split(",")[1];
        } else {
          sBase64Data = sDataUrl || "";
        }

        var sFileType = oFile.type || "";
        if (!sFileType && sFileName.indexOf(".") !== -1) {
          sFileType = sFileName.split(".").pop().toUpperCase();
        }
        if (sFileType.length > 20) {
          sFileType = sFileType.substring(0, 20);
        }

        var dNow = new Date();
        var sFormattedDate = (dNow.getMonth() + 1) + "/" + dNow.getDate() + "/" + dNow.getFullYear();

        var oNewAttachment = {
          AttaId: sFileName,
          Descr: sFileName,
          FileData: sBase64Data,
          id: sFileName,
          fileName: sFileName,
          name: sFileName,
          fileSize: sSizeFormatted,
          size: sSizeFormatted,
          fileType: sFileType,
          uploadDate: sFormattedDate,
          isPdf: isPdf,
          url: sDataUrl
        };

        var oModel = that.getView().getModel("selectedOrder");
        if (oModel) {
          var aAttachments = oModel.getProperty("/attachments") || [];
          var bExists = aAttachments.some(function (att) {
            return (att.fileName === oNewAttachment.fileName) || (att.AttaId === oNewAttachment.AttaId);
          });
          if (!bExists) {
            aAttachments.push(oNewAttachment);
            oModel.setProperty("/attachments", aAttachments);
            oModel.refresh(true);
            MessageToast.show("Attachment added: " + sFileName);
          } else {
            MessageToast.show("File with same name already attached.");
          }
        }

        if (oUploader && typeof oUploader.clear === "function") {
          oUploader.clear();
        }
      };

      oReader.readAsDataURL(oFile);
    },

    onDeleteAttachment: function (oEvent) {
      var oSource = oEvent.getSource();
      var oContext = oSource.getBindingContext("selectedOrder");
      if (!oContext) {
        return;
      }
      var sPath = oContext.getPath();
      var iIndex = parseInt(sPath.split("/").pop(), 10);
      var oModel = this.getView().getModel("selectedOrder");
      var aAttachments = oModel.getProperty("/attachments") || [];
      aAttachments.splice(iIndex, 1);
      oModel.setProperty("/attachments", aAttachments);
      oModel.refresh(true);
      MessageToast.show("Attachment removed.");
    },

    _updateOrderInPersistence: function (oUpdatedOrder) {
      if (!oUpdatedOrder || !oUpdatedOrder.salesOrderNo) {
        return;
      }
      var oSalesOrdersModel = this.getOwnerComponent().getModel("salesOrders");
      if (oSalesOrdersModel) {
        var aOrders = oSalesOrdersModel.getProperty("/orders") || [];
        var iIndex = aOrders.findIndex(function (ord) {
          return String(ord.salesOrderNo) === String(oUpdatedOrder.salesOrderNo);
        });
        if (iIndex >= 0) {
          aOrders[iIndex] = Object.assign({}, aOrders[iIndex], oUpdatedOrder);
          oSalesOrdersModel.setProperty("/orders", aOrders);
          oSalesOrdersModel.setProperty("/filteredOrders", aOrders);
          try {
            localStorage.setItem("sap_sales_orders_store", JSON.stringify(aOrders));
          } catch (e) {}
        }
      }
    },

    onAttachmentPress: function (oEvent) {
      var oSource = oEvent.getSource();
      var oContext = oSource.getBindingContext("selectedOrder") || oSource.getBindingContext();
      var oAttachment = oContext ? oContext.getObject() : null;
      if (!oAttachment) {
        return;
      }

      var sFileName = oAttachment.Descr || oAttachment.fileName || oAttachment.name || oAttachment.AttaId || "attachment";
      var isPdf = oAttachment.isPdf || sFileName.toLowerCase().endsWith(".pdf") || oAttachment.fileType === "application/pdf";
      var sUrl = oAttachment.url;

      if (!sUrl && oAttachment.FileData) {
        if (oAttachment.FileData.startsWith("data:")) {
          sUrl = oAttachment.FileData;
        } else {
          var mime = isPdf ? "application/pdf" : "application/octet-stream";
          sUrl = "data:" + mime + ";base64," + oAttachment.FileData;
        }
      }

      if (isPdf) {
        if (sUrl) {
          if (sUrl.startsWith("data:")) {
            try {
              var parts = sUrl.split(',');
              var mimeMatch = parts[0].match(/:(.*?);/);
              var mimeType = mimeMatch ? mimeMatch[1] : 'application/pdf';
              var byteCharacters = atob(parts[1]);
              var byteNumbers = new Array(byteCharacters.length);
              for (var i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
              }
              var byteArray = new Uint8Array(byteNumbers);
              var blob = new Blob([byteArray], { type: mimeType });
              var blobUrl = URL.createObjectURL(blob);
              var win = window.open(blobUrl, "_blank");
              if (!win) {
                var a = document.createElement("a");
                a.href = blobUrl;
                a.download = sFileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }
            } catch (err) {
              window.open(sUrl, "_blank");
            }
          } else {
            window.open(sUrl, "_blank");
          }
        } else {
          MessageToast.show("Attachment content is not available.");
        }
      } else {
        if (sUrl) {
          var downloadLink = document.createElement("a");
          downloadLink.href = sUrl;
          downloadLink.download = sFileName;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
          MessageToast.show("Downloading " + sFileName);
        } else {
          MessageToast.show("Attachment content is not available.");
        }
      }
    },

    onNavBack: function () {
      var oRouter = this.getRouter();
      if (oRouter) {
        oRouter.navTo("salesOrderList");
      } else {
        window.history.back();
      }
    },

    onCreateNewOrder: function () {
      this.getRouter().navTo("customerWizard");
    }
  });
});
