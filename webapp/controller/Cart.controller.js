sap.ui.define([
  "sap/ui/salesorder/store/controller/BaseController",
  "sap/m/MessageToast",
  "sap/m/MessageBox",
  "sap/ui/core/Fragment",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/StepInput"
], function (BaseController, MessageToast, MessageBox, Fragment, JSONModel, Filter, FilterOperator, StepInput) {
  "use strict";

  return BaseController.extend("sap.ui.salesorder.store.controller.Cart", {
    onInit: function () {
      var oRouter = this.getRouter();
      oRouter.getRoute("cart").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function () {
      this.getModel("appState").setProperty("/currentStep", 5);
      this.recalculateTotals();
    },

    onIncreaseQty: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext("appState");
      var oItem = oContext.getObject();
      oItem.qty = (oItem.qty || 1) + 1;

      // If main item, also increase linked sub-items qty
      var oAppState = this.getModel("appState");
      var aCart = oAppState.getProperty("/cart") || [];
      if (!oItem.isSubItem) {
        aCart.forEach(function (sub) {
          if (sub.isSubItem && sub.parentItem === oItem.item) {
            sub.qty = oItem.qty;
          }
        });
      }

      this.recalculateTotals();
    },

    onDecreaseQty: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext("appState");
      var oItem = oContext.getObject();
      if (oItem.qty > 1) {
        oItem.qty -= 1;

        var oAppState = this.getModel("appState");
        var aCart = oAppState.getProperty("/cart") || [];
        if (!oItem.isSubItem) {
          aCart.forEach(function (sub) {
            if (sub.isSubItem && sub.parentItem === oItem.item) {
              sub.qty = oItem.qty;
            }
          });
        }

        this.recalculateTotals();
      }
    },

    onOpenAddCondition: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext("appState");
      var oItem = oContext.getObject();
      var that = this;

      MessageBox.confirm("Apply promotional condition to '" + oItem.name + "'?\n\n- Special Store Campaign Discount: 10% off", {
        title: "Add Price Condition",
        actions: ["Apply 10% Discount", MessageBox.Action.CANCEL],
        emphasizedAction: "Apply 10% Discount",
        onClose: function (sAction) {
          if (sAction === "Apply 10% Discount") {
            oItem.hasCondition = true;
            oItem.discountPct = 10;
            oItem.conditionText = "Discount -10%";
            that.recalculateTotals();
            MessageToast.show("Condition added: -10% discount applied to item " + oItem.item);
          }
        }
      });
    },

    onRemoveCartItem: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext("appState");
      if (!oContext) {
        return;
      }
      var oItem = oContext.getObject();
      var oAppState = this.getModel("appState");
      var aCart = oAppState.getProperty("/cart") || [];
      var that = this;
      var sItemDesc = oItem.description || oItem.name || ("Item " + oItem.item);

      MessageBox.confirm("Are you sure you want to delete line item " + oItem.item + " (" + sItemDesc + ")?", {
        title: "Delete Line Item",
        actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
        emphasizedAction: MessageBox.Action.DELETE,
        onClose: function (sAction) {
          if (sAction === MessageBox.Action.DELETE) {
            var aFiltered = aCart.filter(function (it) {
              return it.item !== oItem.item && it.parentItem !== oItem.item;
            });
            oAppState.setProperty("/cart", aFiltered);
            that.recalculateTotals();
            MessageToast.show("Line item " + oItem.item + " deleted from cart");
          }
        }
      });
    },

    onRejectionReasonChange: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext("appState");
      if (!oContext) {
        return;
      }
      var oItem = oContext.getObject();
      var sKey = oEvent.getParameter("selectedItem") ? oEvent.getParameter("selectedItem").getKey() : "";
      var sText = oEvent.getParameter("selectedItem") ? oEvent.getParameter("selectedItem").getText() : "";
      if (sKey && sKey !== "-") {
        MessageToast.show("Rejection reason set: " + sText + " for Item " + oItem.item);
      } else {
        MessageToast.show("Rejection reason cleared for Item " + oItem.item);
      }
    },

    onCartTabSelect: function (oEvent) {
      var sKey = oEvent.getParameter("key") || oEvent.getSource().getSelectedKey();
      this.getModel("appState").setProperty("/cartTab", sKey);
    },

    onAddConditionRow: function () {
      var oAppState = this.getModel("appState");
      var aConditions = oAppState.getProperty("/conditions") || [];
      aConditions.push({
        id: "cond-" + Date.now(),
        conditionType: "",
        amount: "",
        per: "1 EA",
        value: ""
      });
      oAppState.setProperty("/conditions", aConditions);
      MessageToast.show("New condition row added");
    },

    onDeleteConditionRow: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext("appState");
      if (!oContext) {
        return;
      }
      var sPath = oContext.getPath();
      var iIndex = parseInt(sPath.split("/").pop(), 10);
      var oAppState = this.getModel("appState");
      var aConditions = oAppState.getProperty("/conditions") || [];
      aConditions.splice(iIndex, 1);
      oAppState.setProperty("/conditions", aConditions);
      MessageToast.show("Condition row deleted");
    },

    // ========================================================
    // VALUE-ADD POPUP & ADD-ON SELECTION
    // ========================================================
    onOpenValueAddPopup: function (oEvent) {
      var oContext = oEvent.getSource().getBindingContext("appState");
      this._selectedParentCartItem = oContext ? oContext.getObject() : null;
      var sMainArticle = (this._selectedParentCartItem && this._selectedParentCartItem.articleId) || "HT-1000";

      var aAddonProducts = [
        { mainArticle: sMainArticle, addonArticle: "AD-1001", description: "Extended Warranty - 1 Year", price: "49.99" },
        { mainArticle: sMainArticle, addonArticle: "AD-1002", description: "Protective Carry Case", price: "24.5" },
        { mainArticle: sMainArticle, addonArticle: "AD-1003", description: "Wireless Charging Station", price: "79" },
        { mainArticle: sMainArticle, addonArticle: "AD-1004", description: "Premium Support Package", price: "99.99" },
        { mainArticle: sMainArticle, addonArticle: "AD-1005", description: "Replacement Power Adapter", price: "19.95" }
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

      if (!this._pValueAddDialog) {
        this._pValueAddDialog = Fragment.load({
          id: oView.getId(),
          name: "sap.ui.salesorder.store.view.fragments.ValueAddDialog",
          controller: this
        }).then(function (oDialog) {
          oView.addDependent(oDialog);
          return oDialog;
        });
      }

      this._pValueAddDialog.then(function (oDialog) {
        var oTable = Fragment.byId(oView.getId(), "valueAddTable");
        if (oTable) {
          oTable.removeSelections(true);
        }
        var oSearchField = Fragment.byId(oView.getId(), "valueAddSearchField");
        if (oSearchField) {
          oSearchField.setValue("");
        }
        oDialog.open();
      });
    },

    onLiveSearchValueAdd: function (oEvent) {
      var sValue = (oEvent.getParameter("newValue") || "").toLowerCase().trim();
      var oModel = this.getView().getModel("valueAddModel");
      var aAll = oModel.getProperty("/allItems") || [];
      if (!sValue) {
        oModel.setProperty("/items", aAll);
      } else {
        var aFiltered = aAll.filter(function (it) {
          return it.addonArticle.toLowerCase().indexOf(sValue) !== -1 ||
                 it.description.toLowerCase().indexOf(sValue) !== -1 ||
                 it.mainArticle.toLowerCase().indexOf(sValue) !== -1;
        });
        oModel.setProperty("/items", aFiltered);
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

      var oAppState = this.getModel("appState");
      var aCart = oAppState.getProperty("/cart") || [];
      var oParent = this._selectedParentCartItem;
      var sParentItem = oParent ? oParent.item : "10";
      var nParentQty = (oParent && oParent.qty) ? oParent.qty : 1;

      var nSubIndex = 1;
      aCart.forEach(function (it) {
        if (it.parentItem === sParentItem && it.item.indexOf(".") !== -1) {
          var nIdx = parseInt(it.item.split(".")[1], 10);
          if (!isNaN(nIdx) && nIdx >= nSubIndex) {
            nSubIndex = nIdx + 1;
          }
        }
      });

      var nParentIndex = -1;
      for (var i = 0; i < aCart.length; i++) {
        if (aCart[i].item === sParentItem) {
          nParentIndex = i;
          break;
        }
      }

      var aNewItems = [];
      for (var j = 0; j < aSelected.length; j++) {
        var oAddon = aSelected[j].getBindingContext("valueAddModel").getObject();
        var sItemNum = sParentItem + "." + (nSubIndex++);
        var fPrice = parseFloat(oAddon.price) || 0;
        var fTotal = +(fPrice * nParentQty).toFixed(2);

        var oNewItem = {
          item: sItemNum,
          articleId: oAddon.addonArticle,
          targetQty: nParentQty,
          qty: nParentQty,
          um: "EA",
          description: oAddon.description,
          name: oAddon.description,
          productNo: "PRD-" + oAddon.addonArticle,
          valueAdds: "-",
          pricePerUnit: fPrice,
          netPrice: fPrice,
          itemPrice: fTotal,
          netValue: fTotal,
          salesPersonId: (oParent && oParent.salesPersonId) || "SP-1042",
          site: (oParent && oParent.site) || "S101",
          itemCat: "ZSRV",
          extendedGuarantee: oAddon.addonArticle.indexOf("1001") !== -1 ? oAddon.addonArticle : "-",
          rejReason: "-",
          discountPct: 0,
          hasCondition: false,
          conditionText: "",
          isSubItem: true,
          isValueAdd: true,
          parentItem: sParentItem
        };
        aNewItems.push(oNewItem);
      }

      if (nParentIndex !== -1) {
        var nInsertAt = nParentIndex + 1;
        while (nInsertAt < aCart.length && aCart[nInsertAt].parentItem === sParentItem) {
          nInsertAt++;
        }
        for (var k = 0; k < aNewItems.length; k++) {
          aCart.splice(nInsertAt + k, 0, aNewItems[k]);
        }
      } else {
        aNewItems.forEach(function (it) { aCart.push(it); });
      }

      oAppState.setProperty("/cart", aCart);
      this.recalculateTotals();

      if (this._pValueAddDialog) {
        this._pValueAddDialog.then(function (oDialog) {
          oDialog.close();
        });
      }

      MessageToast.show(aNewItems.length + " add-on item(s) added to cart");
    },

    onCloseValueAddDialog: function () {
      if (this._pValueAddDialog) {
        this._pValueAddDialog.then(function (oDialog) {
          oDialog.close();
        });
      }
    },

    onOpenAddArticleDialog: function () {
      var oView = this.getView();
      var that = this;

      var oExistingDialog = this.byId("addArticleDialog");
      if (oExistingDialog) {
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
            new Filter("category", FilterOperator.Contains, sQuery)
          ],
          and: false
        }));
      }
      var oTable = Fragment.byId(this.getView().getId(), "selectProductTable");
      if (oTable) {
        var oBinding = oTable.getBinding("items");
        if (oBinding) oBinding.filter(aFilters);
      }
    },

    onSelectProductFromDialogRow: function (oEvent) {
      var oTable = oEvent.getSource();
      var oListItem = oEvent.getParameter("listItem");
      if (oListItem) {
        var oProduct = oListItem.getBindingContext("products").getObject();
        this._addProductObjectToCart(oProduct);
      }
      if (oTable && oTable.removeSelections) {
        oTable.removeSelections(true);
      }
    },

    onAddProductToCartDirect: function (oEvent) {
      var oButton = oEvent.getSource();
      var oProduct = oButton.getBindingContext("products").getObject();
      this._addProductObjectToCart(oProduct);
      var oTable = Fragment.byId(this.getView().getId(), "selectProductTable");
      if (oTable && oTable.removeSelections) {
        oTable.removeSelections(true);
      }
    },

    _addProductObjectToCart: function (oProduct) {
      if (!oProduct) return;
      var oAppState = this.getModel("appState");
      var aCart = oAppState.getProperty("/cart") || [];
      var nSelectedQty = parseInt(oProduct.qty, 10) || 1;

      var oExisting = null;
      for (var i = 0; i < aCart.length; i++) {
        if (aCart[i].articleId === oProduct.articleId && !aCart[i].isSubItem) {
          oExisting = aCart[i];
          break;
        }
      }

      if (oExisting) {
        oExisting.qty += nSelectedQty;
        oExisting.targetQty = oExisting.qty;
        oExisting.itemPrice = +(oExisting.qty * oExisting.netPrice).toFixed(2);
        oExisting.netValue = oExisting.itemPrice;
      } else {
        var nItemNo = (aCart.filter(function(it){ return !it.isSubItem; }).length + 1) * 10;
        var oNewItem = {
          item: String(nItemNo),
          articleId: oProduct.articleId,
          targetQty: nSelectedQty,
          qty: nSelectedQty,
          um: "EA",
          description: oProduct.name,
          name: oProduct.name,
          productNo: "PRD-" + oProduct.articleId,
          valueAdds: "-",
          pricePerUnit: oProduct.price,
          netPrice: oProduct.price,
          itemPrice: +(nSelectedQty * oProduct.price).toFixed(2),
          netValue: +(nSelectedQty * oProduct.price).toFixed(2),
          salesPersonId: "SP-1042",
          site: oProduct.site || "S101",
          itemCat: oProduct.itemCat || "TAN",
          extendedGuarantee: "-",
          rejReason: "-",
          discountPct: 0,
          hasCondition: false,
          conditionText: "",
          isSubItem: false
        };
        aCart.push(oNewItem);
      }

      oAppState.setProperty("/cart", aCart);
      this.recalculateTotals();
      MessageToast.show("Added " + oProduct.name + " (" + nSelectedQty + ") to cart");
    },

    onNextToPricing: function () {
      var oAppState = this.getModel("appState");
      var aCart = oAppState.getProperty("/cart") || [];
      if (aCart.length === 0) {
        MessageBox.warning("Cart is empty. Please add items before proceeding.");
        return;
      }
      this.recalculateTotals();
      this.navTo("priceAvailability");
    },

    onNavToProducts: function () {
      this.navTo("products");
    },

    onNavHome: function () {
      this.navTo("launchpad");
    },

    // Step indicators
    onNavToStepLaunchpad: function () { this.navTo("launchpad"); },
    onNavToStep1: function () { this.navTo("customerSearch"); },
    onNavToStep2: function () { this.navTo("basicDetails"); },
    onNavToStep3: function () { this.navTo("consent"); },
    onNavToStep4: function () { this.navTo("orderType"); },
    onNavToStep5: function () { this.navTo("products"); },
    onNavToStep6: function () { this.navTo("deliveryMethod"); },
    onNavToStep7: function () { this.navTo("orderSummary"); },
    onNavToStepFinal: function () { this.navTo("orderFinal"); }
  });
});
